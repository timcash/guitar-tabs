package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/chromedp/cdproto/runtime"
	"github.com/chromedp/chromedp"
)

func main() {
	headed := os.Getenv("HEADED") == "1"

	allocOpts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", !headed),
		chromedp.Flag("disable-gpu", false),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), allocOpts...)
	defer allocCancel()

	// Create context with a longer timeout for the extended test
	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	var exceptions []string

	chromedp.ListenTarget(ctx, func(ev interface{}) {
		switch e := ev.(type) {
		case *runtime.EventConsoleAPICalled:
			for _, arg := range e.Args {
				val := string(arg.Value)
				if strings.Contains(strings.ToLower(val), "error") || strings.Contains(strings.ToLower(val), "exception") {
					fmt.Printf("CONSOLE ERROR: %s\n", val)
				}
			}
		case *runtime.EventExceptionThrown:
			msg := fmt.Sprintf("EXCEPTION: %s (Detail: %v)", e.ExceptionDetails.Text, e.ExceptionDetails.Exception)
			fmt.Println(msg)
			exceptions = append(exceptions, msg)
		}
	})

	fmt.Println("Starting comprehensive UI & Camera stress test...")
	if headed {
		fmt.Println("Running in headed mode.")
	}

	var stateSamples []testState

	err := chromedp.Run(ctx,
		chromedp.Navigate("http://localhost:5174/"),
		chromedp.WaitVisible("#playBtn", chromedp.ByID),
		chromedp.WaitVisible("#cameraBtn", chromedp.ByID),

		// 1. Cycle through all camera views while stopped
		fmtAction("Cycling camera views (Stopped)..."),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(200*time.Millisecond),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(200*time.Millisecond),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(200*time.Millisecond),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(200*time.Millisecond),

		// 2. Start playback
		fmtAction("Starting playback..."),
		chromedp.Click("#playBtn", chromedp.ByID),
		chromedp.Sleep(40*time.Millisecond),
		captureTestState(&stateSamples),
		chromedp.Sleep(80*time.Millisecond),
		captureTestState(&stateSamples),
		chromedp.Sleep(80*time.Millisecond),
		captureTestState(&stateSamples),

		// 3. Cycle camera views while playing
		fmtAction("Cycling camera views (Playing)..."),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(500*time.Millisecond),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(500*time.Millisecond),
		
		// 4. Exercise Flip and Sound buttons
		fmtAction("Toggling Flip and Sound..."),
		chromedp.Click("#flipXBtn", chromedp.ByID), chromedp.Sleep(300*time.Millisecond),
		chromedp.Click("#soundBtn", chromedp.ByID), chromedp.Sleep(300*time.Millisecond),
		chromedp.Click("#soundBtn", chromedp.ByID), chromedp.Sleep(300*time.Millisecond),
		chromedp.Click("#flipXBtn", chromedp.ByID), chromedp.Sleep(300*time.Millisecond),

		// 5. Pause and Resume
		fmtAction("Pausing..."),
		chromedp.Click("#playBtn", chromedp.ByID),
		chromedp.Sleep(500*time.Millisecond),
		fmtAction("Resuming..."),
		chromedp.Click("#playBtn", chromedp.ByID),
		chromedp.Sleep(1*time.Second),

		// 6. Reset
		fmtAction("Resetting..."),
		chromedp.Click("#resetBtn", chromedp.ByID),
		chromedp.Sleep(500*time.Millisecond),

		// Final safety wait
		chromedp.Sleep(1*time.Second),
	)

	if err != nil {
		log.Fatal(err)
	}

	if len(exceptions) > 0 {
		fmt.Printf("\nTEST FAILED: %d exceptions detected.\n", len(exceptions))
		log.Fatal("Stopping due to browser exceptions.")
	}

	if len(stateSamples) < 3 {
		log.Fatalf("TEST FAILED: expected at least 3 runtime state samples, got %d", len(stateSamples))
	}

	geomZSamples := make([]float64, 0, len(stateSamples))
	for _, sample := range stateSamples {
		if sample.Note0Z != nil {
			geomZSamples = append(geomZSamples, *sample.Note0Z)
		}
	}

	if len(geomZSamples) < 3 {
		log.Fatalf("TEST FAILED: expected at least 3 note geometry samples, got %d", len(geomZSamples))
	}

	if !isStrictlyIncreasing(geomZSamples[:3]) {
		log.Fatalf("TEST FAILED: note geometry samples did not move toward the bridge: %v", geomZSamples[:3])
	}

	if !hasValidHandSample(stateSamples) {
		log.Fatal("TEST FAILED: did not observe a valid hand/finger runtime state sample")
	}

	fmt.Println("\nSUCCESS: All UI elements and camera views exercised without errors!")
	fmt.Printf("Validated note geometry samples: %v\n", geomZSamples[:3])
	fmt.Printf("Validated hand runtime samples: %v\n", summarizeHandSamples(stateSamples))
}

func fmtAction(msg string) chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		fmt.Printf("> %s\n", msg)
		return nil
	})
}

func isStrictlyIncreasing(values []float64) bool {
	for i := 1; i < len(values); i++ {
		if values[i] <= values[i-1] {
			return false
		}
	}
	return true
}

type handState struct {
	Finger   *string  `json:"finger"`
	String   *int     `json:"stringNum"`
	X        *float64 `json:"x"`
	Y        *float64 `json:"y"`
	Z        *float64 `json:"z"`
	Curl     *float64 `json:"curl"`
}

type testState struct {
	ElapsedTime  float64   `json:"elapsedTime"`
	ActiveString *int      `json:"activeString"`
	Note0Z       *float64  `json:"note0Z"`
	NoteCount    int       `json:"noteCount"`
	Hand         handState `json:"hand"`
}

func captureTestState(samples *[]testState) chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context) error {
		var state testState
		err := chromedp.Evaluate(`(() => window.__TABS_TEST_STATE__ ?? null)()`, &state).Do(ctx)
		if err != nil {
			return err
		}
		*samples = append(*samples, state)
		return nil
	})
}

func hasValidHandSample(samples []testState) bool {
	for _, sample := range samples {
		if sample.Hand.Finger == nil || sample.Hand.X == nil || sample.Hand.Curl == nil || sample.Hand.String == nil {
			continue
		}
		if *sample.Hand.Curl <= 0 {
			continue
		}
		if !isKnownFinger(*sample.Hand.Finger) {
			continue
		}
		if !fingerMatchesString(*sample.Hand.Finger, *sample.Hand.String) {
			continue
		}
		return true
	}
	return false
}

func isKnownFinger(finger string) bool {
	switch finger {
	case "p", "i", "m", "a":
		return true
	default:
		return false
	}
}

func fingerMatchesString(finger string, stringNum int) bool {
	switch finger {
	case "p":
		return stringNum >= 4 && stringNum <= 6
	case "i":
		return stringNum == 3
	case "m":
		return stringNum == 2
	case "a":
		return stringNum == 1
	default:
		return false
	}
}

func summarizeHandSamples(samples []testState) []string {
	var summary []string
	for _, sample := range samples {
		if sample.Hand.Finger == nil || sample.Hand.String == nil || sample.Hand.Curl == nil {
			continue
		}
		summary = append(summary, fmt.Sprintf("%s%s curl=%.2f", *sample.Hand.Finger, strconv.Itoa(*sample.Hand.String), *sample.Hand.Curl))
	}
	return summary
}
