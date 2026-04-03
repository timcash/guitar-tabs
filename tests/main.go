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

const (
	baseURL                = "http://localhost:5174"
	codexRoutePromptBase64 = "L3N0YXR1cw=="
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
	var viewportMetaContent string
	var readmeImageCount int
	var readmeScrollY float64
	var codexActionCount int
	var codexTerminalCount int
	var songChanged bool
	var tempoChanged bool
	var menuOpened bool
	var menuClosed bool

	err := chromedp.Run(ctx,
		chromedp.EmulateViewport(390, 844),
		chromedp.Navigate(baseURL+"/"),
		chromedp.WaitVisible("#playBtn", chromedp.ByID),
		chromedp.WaitVisible("#menuBtn", chromedp.ByID),
		chromedp.Evaluate(`document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''`, &viewportMetaContent),

		// 1. Start playback from the compact stage UI.
		fmtAction("Starting playback..."),
		chromedp.Click("#playBtn", chromedp.ByID),
		chromedp.Sleep(40*time.Millisecond),
		captureTestState(&stateSamples),
		chromedp.Sleep(80*time.Millisecond),
		captureTestState(&stateSamples),
		chromedp.Sleep(80*time.Millisecond),
		captureTestState(&stateSamples),

		// 2. Open the fullscreen menu and exercise hidden controls.
		fmtAction("Opening fullscreen menu..."),
		chromedp.Click("#menuBtn", chromedp.ByID),
		chromedp.WaitVisible("#cameraBtn", chromedp.ByID),
		chromedp.Evaluate(`document.querySelector('.player-shell')?.classList.contains('menu-open') ?? false`, &menuOpened),
		chromedp.Sleep(200*time.Millisecond),

		fmtAction("Changing song and tempo..."),
		chromedp.Evaluate(`(() => {
      const select = document.querySelector('#songSelect');
      if (!(select instanceof HTMLSelectElement) || select.options.length < 2) return false;
      select.value = '1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`, &songChanged),
		chromedp.Sleep(300*time.Millisecond),
		chromedp.Evaluate(`(() => {
      const range = document.querySelector('#tempoRange');
      if (!(range instanceof HTMLInputElement)) return false;
      range.value = '132';
      range.dispatchEvent(new Event('input', { bubbles: true }));
      return range.value === '132';
    })()`, &tempoChanged),
		chromedp.Sleep(300*time.Millisecond),

		fmtAction("Cycling camera views from menu..."),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(250*time.Millisecond),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(250*time.Millisecond),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(250*time.Millisecond),
		chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(250*time.Millisecond),

		// 3. Exercise Flip and Sound buttons.
		fmtAction("Toggling Flip and Sound..."),
		chromedp.Click("#flipXBtn", chromedp.ByID), chromedp.Sleep(300*time.Millisecond),
		chromedp.Click("#soundBtn", chromedp.ByID), chromedp.Sleep(300*time.Millisecond),
		chromedp.Click("#soundBtn", chromedp.ByID), chromedp.Sleep(300*time.Millisecond),
		chromedp.Click("#flipXBtn", chromedp.ByID), chromedp.Sleep(300*time.Millisecond),
		chromedp.Click("#menuCloseBtn", chromedp.ByID), chromedp.Sleep(200*time.Millisecond),
		chromedp.Evaluate(`document.querySelector('.player-shell')?.classList.contains('menu-open') ?? false`, &menuClosed),

		// 4. Pause and resume.
		fmtAction("Pausing..."),
		chromedp.Click("#playBtn", chromedp.ByID),
		chromedp.Sleep(500*time.Millisecond),
		fmtAction("Resuming..."),
		chromedp.Click("#playBtn", chromedp.ByID),
		chromedp.Sleep(1*time.Second),

		// 5. Reset from menu.
		fmtAction("Resetting..."),
		chromedp.Click("#menuBtn", chromedp.ByID),
		chromedp.WaitVisible("#resetBtn", chromedp.ByID),
		chromedp.Click("#resetBtn", chromedp.ByID),
		chromedp.Sleep(500*time.Millisecond),
		chromedp.Click("#menuCloseBtn", chromedp.ByID),
		chromedp.Sleep(200*time.Millisecond),

		// 6. Exercise the README route with a simple scroll interaction.
		fmtAction("Opening /readme..."),
		chromedp.Navigate(baseURL+"/readme"),
		chromedp.WaitVisible(".markdown-body", chromedp.ByQuery),
		chromedp.Sleep(300*time.Millisecond),
		chromedp.Evaluate(`document.querySelectorAll('.markdown-body img').length`, &readmeImageCount),
		chromedp.Evaluate(`window.scrollTo(0, document.body.scrollHeight)`, nil),
		chromedp.Sleep(250*time.Millisecond),
		chromedp.Evaluate(`window.scrollY`, &readmeScrollY),

		// 7. Exercise the Codex route with button interactions.
		fmtAction("Opening /codex..."),
		chromedp.Navigate(baseURL+"/codex?prompt="+codexRoutePromptBase64),
		chromedp.WaitVisible(".xterm", chromedp.ByQuery),
		chromedp.WaitVisible("[data-codex-restart]", chromedp.ByQuery),
		chromedp.Sleep(1500*time.Millisecond),
		chromedp.Click("[data-codex-clear]", chromedp.ByQuery),
		chromedp.Sleep(250*time.Millisecond),
		chromedp.Click("[data-codex-restart]", chromedp.ByQuery),
		chromedp.Sleep(1000*time.Millisecond),
		chromedp.Evaluate(`document.querySelectorAll('.codex-action-btn').length`, &codexActionCount),
		chromedp.Evaluate(`document.querySelectorAll('.xterm').length`, &codexTerminalCount),

		// Final safety wait.
		chromedp.Sleep(500*time.Millisecond),
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

	if !strings.Contains(viewportMetaContent, "viewport-fit=cover") || !strings.Contains(viewportMetaContent, "interactive-widget=resizes-content") {
		log.Fatalf("TEST FAILED: viewport meta missing mobile settings: %q", viewportMetaContent)
	}

	if !songChanged {
		log.Fatal("TEST FAILED: expected player menu song selector to change songs")
	}

	if !tempoChanged {
		log.Fatal("TEST FAILED: expected player tempo slider to update from the fullscreen menu")
	}

	if !menuOpened {
		log.Fatal("TEST FAILED: expected the player fullscreen menu to open")
	}

	if menuClosed {
		log.Fatal("TEST FAILED: expected the player fullscreen menu to close after tapping CLOSE")
	}

	if readmeImageCount < 1 {
		log.Fatalf("TEST FAILED: expected README preview to render at least 1 image, got %d", readmeImageCount)
	}

	if readmeScrollY <= 0 {
		log.Fatalf("TEST FAILED: expected README route to scroll, got scrollY=%0.0f", readmeScrollY)
	}

	if codexActionCount < 4 {
		log.Fatalf("TEST FAILED: expected Codex route to render 4 action buttons, got %d", codexActionCount)
	}

	if codexTerminalCount < 1 {
		log.Fatalf("TEST FAILED: expected Codex route to mount an xterm surface, got %d", codexTerminalCount)
	}

	fmt.Println("\nSUCCESS: All UI elements and camera views exercised without errors!")
	fmt.Printf("Validated note geometry samples: %v\n", geomZSamples[:3])
	fmt.Printf("Validated hand runtime samples: %v\n", summarizeHandSamples(stateSamples))
	fmt.Printf("Validated player mobile menu: viewport=%q opened=%t closed=%t songChanged=%t tempoChanged=%t\n", viewportMetaContent, menuOpened, !menuClosed, songChanged, tempoChanged)
	fmt.Printf("Validated README route: images=%d scrollY=%.0f\n", readmeImageCount, readmeScrollY)
	fmt.Printf("Validated Codex route: buttons=%d xterm=%d\n", codexActionCount, codexTerminalCount)
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
	Finger *string  `json:"finger"`
	String *int     `json:"stringNum"`
	X      *float64 `json:"x"`
	Y      *float64 `json:"y"`
	Z      *float64 `json:"z"`
	Curl   *float64 `json:"curl"`
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
