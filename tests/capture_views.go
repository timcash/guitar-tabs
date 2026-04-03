package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/chromedp"
)

type viewCapture struct {
	URL           string
	WaitSelector  string
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

	browserCtx, browserCancel := chromedp.NewContext(allocCtx)
	defer browserCancel()

	ctx, cancel := context.WithTimeout(browserCtx, 60*time.Second)
	defer cancel()

	captures := []viewCapture{
		{
			URL:           "http://localhost:5174/",
			WaitSelector:  "#menuBtn",
			Name:          "mobile-player",
			OpenMenu:      false,
			StartPlayback: true,
			Wait:          1400 * time.Millisecond,
		},
		{
			URL:           "http://localhost:5174/",
			WaitSelector:  "#menuBtn",
			Name:          "mobile-menu",
			OpenMenu:      true,
			StartPlayback: false,
			Wait:          500 * time.Millisecond,
		},
		{
			URL:           "http://localhost:5174/codex?prompt=L3N0YXR1cw==",
			WaitSelector:  "[data-codex-restart]",
			Name:          "mobile-codex",
			OpenMenu:      false,
			StartPlayback: false,
			Wait:          1500 * time.Millisecond,
		},
	}

	for _, capture := range captures {
		var screenshot []byte

		actions := []chromedp.Action{
			chromedp.EmulateViewport(430, 932),
			chromedp.Navigate(capture.URL),
			chromedp.WaitVisible(capture.WaitSelector, chromedp.ByQuery),
			chromedp.Sleep(900 * time.Millisecond),
		}

		if capture.StartPlayback {
			actions = append(actions, chromedp.Click("#playBtn", chromedp.ByID), chromedp.Sleep(250*time.Millisecond))
		}

		if capture.OpenMenu {
			actions = append(actions,
				clickElement("#menuBtn"),
				chromedp.WaitVisible("#menuCloseBtn", chromedp.ByID),
				chromedp.Evaluate(`(() => {
          const select = document.querySelector('#songSelect');
          if (select instanceof HTMLSelectElement && select.options.length > 1) {
            select.value = '1';
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const range = document.querySelector('#tempoRange');
          if (range instanceof HTMLInputElement) {
            range.value = '132';
            range.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return true;
        })()`, nil),
				chromedp.Sleep(250*time.Millisecond),
			)
		}

		actions = append(actions,
			chromedp.Sleep(capture.Wait),
			chromedp.CaptureScreenshot(&screenshot),
		)

		if err := chromedp.Run(ctx, actions...); err != nil {
			panic(err)
		}

		if err := os.WriteFile(filepath.Join(outputDir, capture.Name+".png"), screenshot, 0o644); err != nil {
			panic(err)
		}
	}
}

func clickElement(selector string) chromedp.Action {
	script := `(() => {
    const element = document.querySelector("` + selector + `");
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  })()`

	return chromedp.ActionFunc(func(ctx context.Context) error {
		var clicked bool
		if err := chromedp.Evaluate(script, &clicked).Do(ctx); err != nil {
			return err
		}
		if !clicked {
			return fmt.Errorf("expected clickable element for selector %s", selector)
		}
		return nil
	})
}
