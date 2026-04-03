package main

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/chromedp"
)

type viewCapture struct {
	Name          string
	OpenMenu      bool
	StartPlayback bool
	Wait          time.Duration
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
		{Name: "mobile-player", OpenMenu: false, StartPlayback: true, Wait: 1400 * time.Millisecond},
		{Name: "mobile-menu", OpenMenu: true, StartPlayback: false, Wait: 500 * time.Millisecond},
	}

	for _, capture := range captures {
		var screenshot []byte

		actions := []chromedp.Action{
			chromedp.EmulateViewport(430, 932),
			chromedp.Navigate("http://localhost:5174/"),
			chromedp.WaitVisible("#playBtn", chromedp.ByID),
			chromedp.WaitVisible("#menuBtn", chromedp.ByID),
			chromedp.Sleep(900 * time.Millisecond),
		}

		if capture.StartPlayback {
			actions = append(actions, chromedp.Click("#playBtn", chromedp.ByID), chromedp.Sleep(250*time.Millisecond))
		}

		if capture.OpenMenu {
			actions = append(actions,
				chromedp.Click("#menuBtn", chromedp.ByID),
				chromedp.WaitVisible("#menuCloseBtn", chromedp.ByID),
			)
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
