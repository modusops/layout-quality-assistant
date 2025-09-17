# Figma Layout Quality Assistant

A Figma plugin that helps designers identify common layout quality issues in their designs to improve handoff quality and developer experience.

## Features

The plugin analyzes selected frames and checks for:

- **Unlabeled layers** - Identifies layers with default names (Rectangle, Frame, Group, etc.)
- **Hidden layers** - Finds layers that are not visible
- **Inconsistent spacing values** - Detects spacing that doesn't follow 4px/8px grid system
- **Groups instead of frames** - Identifies groups that should be converted to frames
- **Negative auto-layout spacing** - Finds negative spacing values in auto-layout

## Installation

1. Clone this repository
2. Open Figma
3. Go to Plugins → Development → Import plugin from manifest
4. Select the `manifest.json` file from this repository

## Usage

1. Select a frame in your Figma design
2. Run the "Layout Quality Assistant" plugin
3. Click "Analyze" to check for quality issues
4. Review the results and fix any identified problems

## Development

This is a Figma plugin built with:
- Vanilla JavaScript (no build process required)
- HTML/CSS for the UI
- Figma Plugin API

## File Structure

- `manifest.json` - Plugin configuration
- `code.js` - Main plugin logic
- `ui.html` - Plugin UI interface
- `package.json` - Node.js dependencies (for TypeScript types)

## Contributing

Feel free to submit issues and enhancement requests!
