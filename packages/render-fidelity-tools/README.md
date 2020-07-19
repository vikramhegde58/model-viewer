# Render fidelity tools

This package contains tools and testing processes that enable the
`<model-viewer>` project to ensure high-fidelity 3D model rendering as well
as compare its rendering qualities to those of other renderers.

If you are looking for the `<model-viewer>` web component, please refer to the
[`<model-viewer>` package](../model-viewer) and also the live docs and examples
on [modelviewer.dev](https://modelviewer.dev).

## Development

To get started, follow the instructions in [the main README.md file](../../README.md).

In order to run `npm run update-screenshots`, you must have `imagemagick` installed.

On macOS, you can install `imagemagick` with homebrew: `brew install imagemagick`

On Debian/Ubuntu/Pop!_OS you can install `imagemagick` with `apt`: `sudo apt install imagemagick`

The following commands are available when developing modelviewer.dev:

Command                         | Description
------------------------------- | -----------
`npm run build`                 | Build artifacts required to run testing and review tools
`npm run clean`                 | Deletes all build artifacts
`npm run test`                  | Run a render fidelity check comparing `<model-viewer>` to other renderers
`npm run update-screenshots`    | Update the "golden" screenshots for all renderers

After running `npm run test`, you can look at the results by starting a local web server
(e.g. `npx http-server`) in this folder, then opening `test/results-viewer.html` in a browser.
