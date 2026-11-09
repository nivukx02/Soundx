# NIV Audio Codec - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Open the App
Double-click **`open-in-chrome.bat`** or open **`index.html`** in Chrome

### Step 2: Upload Audio
Drag & drop any music file (MP3, WAV, FLAC, M4A, etc.)

### Step 3: Encode!
Click **"Encode to .NIV Format"** and wait for the magic ✨

---

## 📥 Where Do Files Go?

**Web Version (index.html):**
- Files are downloaded to your browser's **Downloads folder**
- Usually: `C:\Users\[YourName]\Downloads\`
- Check with `Ctrl + J` in Chrome

**CLI Version (cli.js):**
- Files go wherever you specify with `-o` flag
- Example: `node cli.js encode song.mp3 -o D:\SONG\output.niv`

---

## 🎯 What You'll See

### During Encoding:
```
🎵 Analyzing audio...
🎼 Detecting instruments...
📊 Finding peak moments...
✨ Analyzing emotional moments...
📈 Calculating dynamics...
🗜️ Compressing data...
✓ Complete!
```

### After Encoding:
You'll see:
- **Detected Instruments** - What's playing (with percentages!)
- **Peak Moments** - How many intense moments found
- **Goosebumps Moments** - Emotional highlights detected
- **Compression Stats** - Original vs encoded size

### Download Button:
Click **"📥 Download File"** to save your .NIV file

---

## 📖 Viewing Analysis Data

1. Go to **"File Info"** tab
2. Upload your .NIV file
3. See EVERYTHING:
   - 🎼 Complete instrument breakdown
   - 📈 Peak moments timeline
   - ✨ Goosebumps moments with descriptions
   - 📊 Audio dynamics
   - 📋 All metadata

---

## 🎵 Example Workflow

### Encode Your Music:
```
1. Open index.html in Chrome
2. Click "Encode to .NIV" tab
3. Upload "my-song.mp3"
4. Wait 20 seconds for analysis
5. Click "Download File"
6. Get "my-song.niv" in Downloads folder
```

### Decode Back to Audio:
```
1. Click "Decode from .NIV" tab
2. Upload "my-song.niv"
3. Select output format (WAV recommended)
4. Click "Decode to Audio"
5. Get "my-song.wav" in Downloads folder
```

### View Full Analysis:
```
1. Click "File Info" tab
2. Upload "my-song.niv"
3. Scroll through all the analysis data!
```

---

## 🎼 What Gets Analyzed?

Every .NIV file contains:

✅ **Lossless Audio** (100% original quality)
✅ **Instruments Detected:**
   - Strings (violin, guitar, etc.)
   - Wind (flute, sax, trumpet, etc.)
   - Percussion (drums, cymbals, etc.)
   - Keyboard (piano, organ, etc.)
   - Electronic (synths, bass, etc.)
   - Vocals (singing, voice)

✅ **Peak Moments** (loud/intense parts)
✅ **Goosebumps Moments** (emotional highlights)
✅ **Frequency Analysis** (complete spectrum)
✅ **Audio Dynamics** (loudness, range)

---

## 💾 File Sizes

Typical results:
- **5 min song, 44.1kHz stereo:**
  - Original WAV: 50 MB
  - NIV encoded: 25-30 MB (40-50% smaller)
  - With full analysis embedded!

---

## ⚠️ Important Notes

### Browser Requirements:
- ✅ Chrome 80+ or Edge 80+
- ✅ Modern web browser with Web Audio API
- ❌ Does NOT work in Internet Explorer
- ❌ May not work in older Firefox versions

### File Limits:
- Works best with files < 100 MB
- Larger files take longer to analyze
- Very large files may crash browser (memory limit)

### Audio Formats:
- **Input:** Anything your browser can decode
  - MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, etc.
- **Output:** WAV (32-bit float lossless)
  - FLAC/MP3 export coming soon!

---

## 🐛 Troubleshooting

### "No download button appears"
- Open browser console (F12) to check for errors
- Make sure you're using Chrome 80+
- Try refreshing the page

### "Analysis takes forever"
- Large files (>10 min) can take 2-3 minutes
- Check console (F12) for progress messages
- Be patient - analysis is CPU intensive!

### "Encoding failed"
- Check if your browser supports CompressionStream API
- Open `test.html` to verify browser compatibility
- Try a different audio file format

### "Can't find .NIV file"
- Check your Downloads folder (`Ctrl + J` in Chrome)
- Look for file with .niv extension
- Check browser settings for download location

---

## 🧪 Testing

Open **`test.html`** to run automated tests:
- API compatibility check
- Delta encoding test
- CRC32 checksum test
- Compression test
- Full integration test

All tests should show ✓ PASS in green.

---

## 📚 Learn More

- **FEATURES.md** - Complete feature documentation
- **README.md** - Technical specifications
- **BUGFIXES.md** - Bug fix history

---

## 🎉 You're Ready!

Now you know how to:
- ✅ Encode audio with full analysis
- ✅ Decode back to lossless audio
- ✅ View complete musical intelligence
- ✅ Find your .NIV files

**Start encoding and discover what's inside your music!** 🎵✨

---

## 📞 Quick Reference

| Task | Command/Action |
|------|----------------|
| Open app | Double-click `open-in-chrome.bat` |
| Encode | Upload in "Encode" tab |
| Decode | Upload in "Decode" tab |
| View info | Upload in "Info" tab |
| Find downloads | `Ctrl + J` in Chrome |
| Run tests | Open `test.html` |
| Check console | Press `F12` in browser |

---

**Happy encoding! 🎵**
