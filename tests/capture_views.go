package main

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/chromedp"
)

type viewCapture struct {
	Name        string
	CameraTaps  int
	StartPlayback bool
	Wait        time.Duration
}

func main() {
	outputDir := filepath.Join("..", "docs", "screenshots")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		panic(err)
	}

	allocOpts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", false),
		chromedp.Flag("use-gl", "swiftshader"),
		chromedp.Flag("enable-webgl", true),
		chromedp.Flag("ignore-gpu-blocklist", true),
		chromedp.Flag("enable-unsafe-swiftshader", true),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), allocOpts...)
	defer allocCancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	captures := []viewCapture{
		{Name: "classic-overview", CameraTaps: 0, StartPlayback: false, Wait: 500 * time.Millisecond},
		{Name: "player-playback", CameraTaps: 1, StartPlayback: true, Wait: 1200 * time.Millisecond},
		{Name: "birdseye-overview", CameraTaps: 2, StartPlayback: false, Wait: 500 * time.Millisecond},
		{Name: "cinematic-playback", CameraTaps: 3, StartPlayback: true, Wait: 1200 * time.Millisecond},
	}

	for _, capture := range captures {
		var screenshot []byte

		actions := []chromedp.Action{
			chromedp.Navigate("http://127.0.0.1:5174/"),
			chromedp.WaitVisible("#playBtn", chromedp.ByID),
			chromedp.WaitVisible("#cameraBtn", chromedp.ByID),
			chromedp.EmulateViewport(1440, 900),
			chromedp.Sleep(1200 * time.Millisecond),
		}

		for i := 0; i < capture.CameraTaps; i++ {
			actions = append(actions, chromedp.Click("#cameraBtn", chromedp.ByID), chromedp.Sleep(250*time.Millisecond))
		}

		if capture.StartPlayback {
			actions = append(actions, chromedp.Click("#playBtn", chromedp.ByID))
		}

		actions = append(actions,
			chromedp.Sleep(capture.Wait),
			chromedp.Screenshot("#app", &screenshot, chromedp.NodeVisible, chromedp.ByID),
		)

		if err := chromedp.Run(ctx, actions...); err != nil {
			panic(err)
		}

		if err := os.WriteFile(filepath.Join(outputDir, capture.Name+".png"), screenshot, 0o644); err != nil {
			panic(err)
		}
	}
}
