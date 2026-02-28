# Image Cropper PCF Control

A Power Apps Component Framework (PCF) control for cropping, rotating, and transforming images, built with React and designed for robust, modular, and Power Apps-compliant use.

![Image Cropper Demo](./images/image-cropper-demo.gif)

## Overview

The Image Cropper control provides a modern, accessible, and highly configurable image cropping experience for both Model-driven and Canvas Power Apps. It supports aspect ratio locking, scaling, rotation, circular/elliptical cropping, and advanced browser scaling handling. The control is built with React functional components and custom hooks for maintainability and extensibility.

## Features

- Crop images with drag-and-resize UI
- **Pan and zoom**: drag to pan the image, mouse wheel to zoom (desktop), pinch-to-zoom on touch; image always fills the crop viewport (no empty space)
- Lock aspect ratio or allow freeform cropping
- Rotate and scale images
- Circular/elliptical crop support
- Handles browser and container scaling
- Default crop values from manifest
- Robust image load and crop state management
- Outputs cropped image as base64 PNG
- Fully modular React hooks architecture

## Installation

[Download Latest](https://github.com/rwilson504/PCFControls/releases/latest/download/RAW.ImageCropControl_managed.zip)

Import the managed solution into your environment.
Ensure PCF controls are enabled. [Enable PCF](https://docs.microsoft.com/en-us/powerapps/developer/component-framework/component-framework-for-canvas-apps)

## Sample Application

A sample solution is available for testing and demonstration:

[Download Sample App](./Sample/RAW%20Image%20Crop.msapp)

## Configuration

Add the Image Cropper control to your form or app and configure the required properties.
**Any field referenced in the properties must be present in your view or data source.**

### Control Properties

| Name                | Usage    | Type             | Required | Default | Description                                                      |
|---------------------|----------|------------------|----------|---------|------------------------------------------------------------------|
| imageInput          | input    | SingleLine.Text  | Yes      |         | Image source (base64 or URL)                                     |
| aspect              | input    | Decimal Number   | No       | 0       | Aspect ratio (width/height), blank for freeform                  |
| minWidth            | input    | Whole.Number     | No       | -1      | Minimum crop width                                               |
| maxWidth            | input    | Whole.Number     | No       | -1      | Maximum crop width                                               |
| minHeight           | input    | Whole.Number     | No       | -1      | Minimum crop height                                              |
| maxHeight           | input    | Whole.Number     | No       | -1      | Maximum crop height                                              |
| rotation            | input    | Whole.Number     | No       | 0       | Image rotation in degrees                                        |
| scaling             | input    | Decimal Number   | No       | 1       | Image scaling factor                                             |
| circularCrop        | input    | TwoOptions       | No       | false   | Enable circular/elliptical crop                                  |
| keepSelection       | input    | TwoOptions       | No       | false   | Keep crop selection after crop                                   |
| locked              | input    | TwoOptions       | No       | false   | Lock crop area (disable editing)                                 |
| disabled            | input    | TwoOptions       | No       | false   | Disable the control                                              |
| ruleOfThirds        | input    | TwoOptions       | No       | false   | Show rule-of-thirds grid                                         |
| DefaultUnit         | input    | OptionSet        | No       | %       | Default crop unit (px or %)                                      |
| DefaultX            | input    | Whole.Number     | No       | -1      | Default crop X position                                          |
| DefaultY            | input    | Whole.Number     | No       | -1      | Default crop Y position                                          |
| DefaultWidth        | input    | Whole.Number     | No       | -1      | Default crop width                                               |
| DefaultHeight       | input    | Whole.Number     | No       | -1      | Default crop height                                              |
| showCropByDefault   | input    | TwoOptions       | No       | false   | If true (legacy), show crop box on load; if false, show only after double-click to enter crop mode. |
| enableCropping      | input    | TwoOptions       | No       | false   | When true, shows crop rectangle/overlay and enables crop interactions. |
| enablePanImage      | input    | TwoOptions       | No       | false   | When true, allows panning the image (subject to Use Shift to pan image). |
| useShiftToPanImage  | input    | TwoOptions       | No       | false   | When true, panning only works while Shift is held; when false, pan works without Shift if enablePanImage is true. |
| enableDragDropLoad  | input    | TwoOptions       | No       | false   | When true, allows dropping an image file from the computer onto the control (web only). |
| actionSchema        | bound    | SingleLine.Text  | No       |         | Defines the schema for the action output object (hidden)         |

### Output Properties

| Name           | Type                | Description                                                         |
|----------------|--------------------|---------------------------------------------------------------------|
| imageOutput    | Multiple Lines Text | Cropped image as base64 PNG (data URL)                              |
| actionOutput   | Object             | The most recent action and its data                                 |
| zoomMultiplier | Decimal             | Current zoom multiplier vs baseScale (0.4–3.0). Bind to Slider for bi-directional sync. |

## Drag-and-drop (web)

**Drag-and-drop** of an image file from Windows File Explorer or macOS Finder onto the control is supported in web browsers when **Enable drag-and-drop image load** (`enableDragDropLoad`) is set to **true**. It may not work in Power Apps mobile. Dropped images use the same load and transform pipeline as other sources; max file size 15MB.

## Pan and zoom

The control supports smooth pan and zoom while keeping the crop rectangle semantics unchanged. **By default, cropping and panning are off**; enable them via input properties (see [Toggling crop and pan from Power Apps](#toggling-crop-and-pan-from-power-apps)).

### Shift-to-pan mode

When **Enable pan image** is true, panning behavior depends on **Use Shift to pan image**:

- **Use Shift to pan image = true**: Panning is only active while **Shift** is held. Crop and pan are mutually exclusive by mode:

| Shift held   | Drag does        | Crop (move/resize/handles) |
|-------------|------------------|----------------------------|
| **Yes**     | Pans the image   | Disabled                   |
| **No**      | —                | Enabled (normal behavior)  |

- **Use Shift to pan image = false**: Panning works on drag (no Shift required). If **Enable cropping** is also true, pointer-down on the crop rect/handles is treated as crop; pointer-down elsewhere is treated as pan.

- **Desktop (Shift-to-pan)**: Hold Shift then drag to pan; release Shift to return to crop. Cursor shows grab/grabbing in pan mode. Keyup Shift or mouse leave clears pan mode so it does not get stuck.
- **Zoom**: Mouse wheel and pinch-to-zoom are unchanged and do not require Shift.
- **Touch**: Existing touch crop behavior is unchanged; Shift applies only to keyboard/mouse.

### Cover fit and constraints

- **Initial fit**: On image load, the image is scaled to **cover** the viewport (like CSS `object-fit: cover`): `baseScale = max(viewportW / imgW, viewportH / imgH)`, then centered with `translateX = (viewportW - imgW*scale)/2`, `translateY = (viewportH - imgH*scale)/2`, then clamped so there is no empty space inside the crop box.
- **Resize**: When the control is resized, zoom level is preserved relative to cover (`newScale = newBaseScale * (currentScale/oldBaseScale)`), and the current pan center is preserved where possible; translation is then clamped so the image still fills the viewport.
- **Pan**: Translation is always clamped so the image fully covers the viewport (no blank gaps).
- **Rendering**: The image is clipped to the viewport (`overflow: hidden`).

### Toggling crop and pan from Power Apps

Cropping and panning are **off by default**. You can control them with variables and buttons so Ben (or any user) can toggle features without double-click.

**1. Add variables (e.g. in OnStart or as needed)**  
- `gblEnableCropping`, `gblEnablePan`, `gblUseShiftPan` — all default to `false` if not set.

**2. Button OnSelect (toggle)**  
- **btnToggleCrop**.OnSelect: `Set(gblEnableCropping, !gblEnableCropping)`  
- **btnTogglePan**.OnSelect: `Set(gblEnablePan, !gblEnablePan)`  
- **btnToggleShiftPan**.OnSelect: `Set(gblUseShiftPan, !gblUseShiftPan)`

**3. Bind the control**  
- ImageCrop1.**enableCropping** = `gblEnableCropping`  
- ImageCrop1.**enablePanImage** = `gblEnablePan`  
- ImageCrop1.**useShiftToPanImage** = `gblUseShiftPan`

With these defaults (`false`), the control starts with crop and pan disabled until the app turns them on.

## Changelog / notes

- **Display name rename (Eurasia Image Crop)**: The user-facing name was changed from “RAW! Image Crop” to **Eurasia Image Crop**. Only display strings were updated; namespace, constructor, and bindings are unchanged.
  - **Files updated for the rename**: `ImageCrop/resources/ImageCrop.1033.resx` (value for `ImageCrop_DisplayName`). The manifest references this via `display-name-key` and was not modified.
- **Pan mode**: Pan is gated by Shift (see table above); crop is disabled while Shift is held.
- **Cover-fit**: Initial fit and resize behavior use the cover math and constraint logic above; existing crop coordinate outputs are unchanged.

### Regression fixes (pan, crop overlay, resize, cover-fit)

- **Pan horizontal + vertical**: Pan was only updating Y because pointer handlers were on the **image** (which has a CSS transform). Moving pan/pinch handlers to the **viewport** div and using `clientX`/`clientY` for deltas ensures both axes use the same coordinate space: `newTranslateX = startTranslateX + (currentClientX - startClientX)`, same for Y. Pointer capture is on the viewport so all move events are received. Clamp in `viewportUtils` applies the same formula to X and Y (`[minX, 0]` and `[minY, 0]`); no change to clamp math.
- **Crop box vs highlight sync**: The CropWrapper previously overrode `getBox` and returned box dimensions in a different coordinate system than the library uses to draw the overlay, so the outline and the shaded mask drifted. The override was **removed** so ReactCrop uses a single source of truth: crop rect in **displayed media space** (the same space the library uses for the overlay). Outline and mask now stay in sync.
- **Crop resize and 2D drag**: The image had `pointerEvents: "auto"`, so it sat above the crop overlay in the hit-test order and swallowed pointer events. The image is now `pointerEvents: "none"`. Pan and pinch are handled on the viewport; when Shift is not held, pointer events hit the crop overlay (handles and drag) so resize and 2D crop drag work again.
- **Cover-fit not applied for some images**: The “resize” branch (preserve zoom) was running when the **image** changed as well as when the viewport resized. We now only run that branch when the **viewport** dimensions change; when natural size changes (new image or first load), we always run initial cover-fit. `lastNaturalRef` tracks natural dimensions so a new image always gets `baseScale = max(viewportW/imgW, viewportH/imgH)` and centered, clamped translation.
- **Coordinate space**: Pan/zoom transform is in **viewport space** (container pixels). Crop state is in **displayed media space** (react-image-crop’s PixelCrop). We did not change how crop output is produced; `useCropToBase64` still uses the library’s completedCrop and image dimensions. No existing inputs/outputs or crop semantics were changed.

### Crop box visibility and cover-fit (follow-up)

- **Why the crop box disappeared**: With pan/zoom, the media (image) was given layout size `naturalWidth`×`naturalHeight` and a CSS transform. ReactCrop sizes its overlay from the media’s layout size, so the overlay was drawn in a huge (e.g. 1920×1080) coordinate space while the visible viewport was only 450×350; the crop outline and mask were effectively off-screen or at the wrong scale. In addition, `crop` could be `undefined` when no default was set, so the library sometimes had nothing to draw.
- **Fix**: (1) When pan/zoom is active, the **media** passed to ReactCrop is a **viewport-sized div** (same width/height as the control). The image is inside that div with `position: absolute` and the same uniform scale + translate. The overlay is therefore drawn in viewport coordinates and stays visible and aligned. (2) When an image is present, `crop` is never undefined: we pass `crop ?? FULL_IMAGE_CROP` (100% full image) so the overlay always has a rect to render. (3) Pixel crop from the library (viewport space) is converted to image (natural) space in `onComplete` so `useCropToBase64` and outputs are unchanged.
- **Cover-fit enforcement**: The image always fills the control with no blank space: `baseScale = max(viewportW / imgW, viewportH / imgH)` in `viewportUtils.getCoverScale` (single uniform scale, no stretching). Fit is applied after image load (using `naturalWidth`/`naturalHeight`) and after container resize (via ResizeObserver on the viewport ref). Viewport dimensions are the actual rendered bounds (`clientWidth`/`clientHeight` of the container). First load and image-source changes always run initial cover-fit; only viewport resize preserves zoom/pan.
- **Verified**: 450×350 viewport fills with no empty space for wide, tall, and square images; aspect ratio is preserved (uniform scale only). Crop box outline and shaded highlight are visible and aligned; crop can be moved and resized when Shift is not held; Shift still disables crop interactions only while held.
- **Coordinate space**: With viewport-sized media, the library’s `onComplete` PixelCrop is in viewport pixels; we convert to image pixels for `completedCrop` so existing crop outputs and semantics are unchanged.

### Crop mouse tracking and zoom-out

- **cropRect coordinate space**: When pan/zoom is active, **crop is stored and passed in viewport space (px)**. The media is a viewport-sized div, so the library’s hit-testing, drag, and resize all use the same viewport coordinates; no offset. Crop is created only when the user enters crop mode (e.g. double-click) or when showCropByDefault is true (legacy); default rect is centered 70% or defaultCrop converted to viewport px. `onChange` from the library updates crop (viewport px); we mark it so we don’t re-convert. Export still converts viewport → image in `onComplete` for `useCropToBase64`.
- **Pointer mapping**: The library receives pointer events on the overlay; it uses the media’s `getBoundingClientRect()` (the viewport-sized div), so `clientX - rect.left` / `clientY - rect.top` are viewport px. We don’t do our own pointer→crop math; we just ensure the crop we pass is in viewport px so the library’s internal drag/resize math matches.
- **Why zoom-out was broken**: Wheel used a fixed step (0.9 / 1.1). Zoom-out (scale × 0.9) was correct in code; the real issue was ensuring **minScale is always the cover scale** (never current scale) and that both directions apply. We use `Math.exp(-e.deltaY * 0.001)` so scroll down = zoom out, scroll up = zoom in; no early-return for deltaY. `zoomAt` clamps to `[minScale, maxScale]`; zoom-out stops at minScale so the viewport stays filled.

### Crop off by default (no UI buttons, controlled by inputs)

- **Crop activation (no UI buttons)**: Crop box is **off by default**. The crop outline/mask/handles appear **only** when **Enable cropping** (`enableCropping`) is true or **Show crop by default** (`showCropByDefault`, legacy) is true. There is no double-click to toggle; use Power Apps buttons/variables bound to `enableCropping` (see [Toggling crop and pan from Power Apps](#toggling-crop-and-pan-from-power-apps)). When cropping is first enabled and there is no crop yet, the rect is set from (1) saved default crop (DefaultX/Y/Width/Height) converted to viewport px, or (2) last completed crop in viewport px, or (3) a **centered 70% viewport rect** (never full control size). When cropping is turned off, the overlay is hidden but crop state is preserved so re-enabling returns to the prior selection. Pan/zoom and pan (when enabled) remain available.
- **No full-viewport default**: Any code that initialized the crop rect to full viewport on load has been removed. When crop is created (on first activation or when legacy showCropByDefault is true), the default is always **centered 70%** (or defaultCrop/completedCrop if present), never full control size.
- **Zoom-out fix**: `minScale` is from `getScaleLimits()` (cover scale); it is **not** set from current scale, so zoom-out is never blocked by a moving floor. **Why zoom-out was still broken**: When viewport or image dimensions were 0, `getScaleLimits` returned `minScale = 0`, `maxScale = 0`, so the clamp forced `newScale = 0`. **Fix**: `getScaleLimits` returns safe limits when any dimension is ≤ 0; `maxScale = Math.max(minScale * 8, minScale)`. Wheel uses `zoomFactor = Math.exp(-deltaY * 0.001)` with **no early-return** for `deltaY > 0` (scroll down = zoom out). Cover-fit runs only on image load and container resize, not on wheel/pan. Clamp: `Math.max(minScale, Math.min(maxScale, newScale))`.

### Zoom IN fix (scale overwritten after zoom)

- **minScale / maxScale**: `minScale = getCoverScale(viewportW, viewportH, imgW, imgH)` (cover fit); `maxScale = minScale * 8` (strictly greater than minScale so zoom-in has headroom). Clamp is `Math.max(minScale, Math.min(maxScale, proposedScale))` — correct order, no swap. Wheel and pinch both call the same `zoomAt(px, py, factor)` path; zoom factor `Math.exp(-deltaY * 0.001)` so wheel up = zoom in, wheel down = zoom out.
- **What blocked zoom-in**: (1) The cover-fit effect could run again with the same deps and overwrite scale back to baseScale (initial-fit branch ran whenever `!isResize`). (2) maxScale was computed as `Math.max(minScale * 8, minScale)`, which could in theory equal minScale in edge cases; zoom-in needs maxScale strictly > minScale.
- **What fixed it**: (1) Run initial cover-fit only when dimensions actually changed: `else if (naturalChanged || isFirstRun)` so we never overwrite scale after user zoom. (2) Set `maxScale = minScale * MAX_SCALE_MULTIPLE` (8×) with no Math.max so maxScale is always strictly greater than minScale.
- **maxScale now**: Zoom range is 0.4×–3.0× of baseScale (see below).

### Zoom range (0.4×–3.0× of baseScale)

- **baseScale**: The scale used on image load to cover-fit and center the image (same as `getCoverScale(viewportW, viewportH, imgW, imgH)`). It changes only on image load and control resize; it is not recomputed on wheel or render.
- **Zoom bounds**: `minScale = baseScale * MIN_ZOOM_MULTIPLIER` (0.4), `maxScale = baseScale * MAX_ZOOM_MULTIPLIER` (3.0). Constants in `viewportUtils.ts`. Scale is clamped with `Math.max(minScale, Math.min(maxScale, proposedScale))`. When baseScale changes (resize/new image), the hook recomputes min/max and clamps current scale to the new range.

### Viewport vs image space, applyScale, pan clamp

- **Coordinate spaces and export**: (A) **Viewport space**: origin top-left of control, units = CSS pixels; crop rect is in this space. (B) **Image natural space**: origin top-left of source bitmap, units = naturalWidth × naturalHeight. (C) **View transform**: image → viewport is `vx = ix*scale + translateX`, `vy = iy*scale + translateY`. Export is **viewport-based**: `ix = (vx - translateX)/scale`, `iy = (vy - translateY)/scale`, `iw = vw/scale`, `ih = vh/scale`, . Output canvas = crop window; drawImage at (tx - cropX, ty - cropY) with scaled size; same `scale`, `translateX`, `translateY` used for rendering are used for export (no “centered” or baseScale-only assumption).
- **Viewport = control**: The crop overlay viewport is always the full control (e.g. 450×350). Viewport rect is `vx=0, vy=0, vw=viewportW, vh=viewportH`. The media passed to ReactCrop is a viewport-sized div (same size as the control), so crop rect and overlay are in **viewport (control) coordinates**; they do not shrink with the image.
- **Crop rect**: Stored and drawn in viewport pixels. When not using pan/zoom, export uses completedCrop in display space. When using pan/zoom, export is viewport-based: drawImage at (tx - cropX, ty - cropY) with scaled size; areas outside the image stay transparent.
- **applyScale(newScale, anchorPx?, anchorPy?)**: Single function for wheel, pinch, and external scale updates. Keeps the image anchored at the pointer (when px/py provided) or at viewport center (when omitted). Math: image point under anchor `ix = (px - tx) / s`, `iy = (py - ty) / s`; then `ntx = px - ix * newScale`, `nty = py - iy * newScale`; then clamp translate so image still covers viewport. Wheel calls `zoomAt(px, py, factor)` which clamps proposed scale and calls `applyScale(clampedScale, px, py)`.
- **Pan clamp**: So the image always covers the viewport (no blank): `rw = imgW*scale`, `rh = imgH*scale`; `tx` in `[viewportW - rw, 0]`, `ty` in `[viewportH - rh, 0]`. Formula: `translateX = Math.max(viewportW - rw, Math.min(0, tx))`, same for Y. If `rw < viewportW` (should not happen at minScale=coverScale), we center: `tx = (viewportW - rw)/2`. This allows free drag within valid limits.
- **Wheel**: Handler attached to the control container with `addEventListener("wheel", ..., { passive: false })`; `preventDefault()` always called so the page doesn’t scroll.

### ZoomMultiplier output and bi-directional sync with Slider

- **PCF constraint**: Inputs (e.g. `scaling`) are read-only; the control cannot set an input. To sync zoom back to the app we expose an **output** property that the app binds to (e.g. Slider.Default or a variable).
- **Output**: `zoomMultiplier` (Decimal). Current zoom as a multiplier of baseScale, clamped to [0.4, 3.0]. Updated whenever zoom changes from any source: wheel, pinch, host `scaling` input, or after image load/resize (baseScale change). The control stores the value and calls `notifyOutputChanged()`; `getOutputs()` returns `{ zoomMultiplier: this._zoomMultiplier, ... }`.
- **Power Apps binding (Option A — simplest)**  
  - Slider.Min = 0.4, Slider.Max = 3  
  - Slider.Default = Coalesce(ImageCropControl.ZoomMultiplier, 1)  
  - ImageCropControl.scaling = Slider.Value  
  If the slider doesn’t update when Default changes while interacting, use Option B.
- **Power Apps binding (Option B — robust)**  
  - OnVisible/OnStart: `Set(gblZoom, 1)`  
  - ImageCropControl.scaling = gblZoom; Slider.Value (or Default) = gblZoom  
  - Slider.OnChange: `Set(gblZoom, Self.Value)`  
  - Use a low-frequency Timer (e.g. 200 ms) or another pattern: `Set(gblZoom, ImageCropControl.ZoomMultiplier)` so the slider thumb reflects wheel/pinch zoom.

## Advanced Usage

- All crop, aspect, and transform logic is modularized in custom React hooks for maintainability.
- The control automatically handles browser scaling, image load timing, and crop validity.
- Circular/elliptical cropping uses canvas ellipse masking for true round crops.
- Default crop values are only applied after the image is loaded.

## Resources

- [PCF Documentation](https://docs.microsoft.com/en-us/powerapps/developer/component-framework/overview)
- [react-image-crop](https://github.com/dominictarr/react-image-crop)
- [PCF Controls Repo](https://github.com/rwilson504/PCFControls)
