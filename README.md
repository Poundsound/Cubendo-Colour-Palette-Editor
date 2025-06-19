<<<<<<< HEAD
# Cubase Color Palette Editor

A user-friendly React app for managing Cubase color palettes. This tool allows you to upload your Cubase `Defaults.xml`, edit up to 32 base colors (with 4 tints each, 128 total), and export a new `Defaults.xml` for use in Cubase.
=======
# Cubase 14 Color Palette Editor

A user-friendly React app for managing Cubase color palettes. This tool allows you to upload your Cubase `Defaults.xml`, edit up to 32 base colors (with 4 tints each, 128 total), and export a new `Defaults.xml` for use in Cubase. This has not been tested on earlier versions.
>>>>>>> 3c91ff58c2ac357b9a52b261ec0961685e5a2f7a

## Features
- Upload your Cubase `Defaults.xml` file
- Edit up to 32 base colors, each with 4 tints (128 colors total)
- Preview and adjust colors in a modern UI
- Export and download a new `Defaults.xml` with your updated color palette
- No data is sent to any server; all processing is done locally in your browser

## Usage
<<<<<<< HEAD
1. Open the app in your web browser.
2. Click **Upload Defaults.xml** and select your Cubase `Defaults.xml` file.
3. Edit the colors as desired using the color pickers.
4. Click **Export** to download a new `Defaults.xml` with your changes.
5. Replace the color section in your Cubase configuration with the exported file as needed.

> **Note:** This app is for personal, non-commercial use only. Redistribution is not permitted. See the LICENSE file for details.

=======

Before use, it's advised to create a copy of your `Defaults.xml` file found in (C:\Users\(USERNAME)\AppData\Roaming\Steinberg\Cubase 14) and store it seperately --just in case. 

Prior to using the app, it's worth "saving colour set as default" in Cubase, then close Cubase.

![image](https://github.com/user-attachments/assets/8523cc58-a826-49f6-8af5-5f63e089bf3b)

1. Open the app in your web browser.
2. Click **Upload Defaults.xml** and select your Cubase `Defaults.xml` file. 
3. Edit the colors as desired using the color pickers. 
4. Click **Export** to download a new `Defaults.xml` with your changes.
5. Replace the `Defaults.xml` in your Cubase directorty.
6. In Cubase open the colour settings and choose "reset colour set to default" - this will pull the new colour palette.

> **Note:** This app is for personal, non-commercial use only. Redistribution is not permitted. See the LICENSE file for details.

>>>>>>> 3c91ff58c2ac357b9a52b261ec0961685e5a2f7a
## Donationware
If you find this tool helpful, please consider making a donation to support its development. [Your donation link here]

## License
This software is provided as donationware for personal, non-commercial use only. See the [LICENSE](./LICENSE) file for full terms.

## Disclaimer
This project is not affiliated with or endorsed by Steinberg Media Technologies GmbH. "Cubase" is a trademark of Steinberg.
