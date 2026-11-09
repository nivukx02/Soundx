# ENCODER/DECODER STATUS CHECK

## 🔍 COMPREHENSIVE DIAGNOSTIC

### Quick Test Tool Created:
**File:** `encoder-decoder-test.html`

This file will test:
1. ✅ Function availability (all 10 functions)
2. ✅ Encoder functionality (generate test audio + encode)
3. ✅ Decoder functionality (decode + verify lossless)
4. ✅ Full encode/decode cycle
5. ✅ Detailed logging

---

## 🧪 HOW TO TEST:

### **Step 1: Open Test Page**
```
Open: encoder-decoder-test.html in Chrome
```

### **Step 2: Run Tests**
1. Click "▶️ Test Functions" - Should show all ✅
2. Click "▶️ Test Encoder" - Should create test audio and encode
3. Click "▶️ Test Decoder" - Should decode and verify

### **Step 3: Check Results**
- All tests should show ✅ PASSED
- Check execution log for details

---

## 🔧 COMMON ISSUES & FIXES

### **Issue 1: Functions Undefined**

**Symptoms:**
- ❌ analyzeAudio: undefined
- ❌ encodeToNIV: undefined

**Fix:**
- Ensure all scripts loaded in correct order
- Check browser console (F12) for errors
- Scripts should load as regular JS (no type="module")

**Verify:**
```javascript
// In browser console:
console.log(typeof analyzeAudio);     // should be "function"
console.log(typeof encodeToNIV);      // should be "function"
console.log(typeof decodeFromNIV);    // should be "function"
```

---

### **Issue 2: Encoder Not Working**

**Possible Causes:**

1. **Analysis Function Missing**
   ```javascript
   // Check in console:
   console.log(typeof analyzeAudio); // must be "function"
   ```

2. **Audio Buffer Invalid**
   ```javascript
   // Check if audio loaded:
   console.log(encodeFileData);
   console.log(encodeFileData?.audioBuffer);
   ```

3. **encodeToNIV Function Error**
   - Check console for error messages
   - Look for compression errors
   - Check memory limits

**Debug Steps:**
1. Open browser console (F12)
2. Upload audio file
3. Watch for error messages
4. Check network tab for loading issues

---

### **Issue 3: Decoder Not Working**

**Possible Causes:**

1. **Invalid .NIV File**
   - File corrupted
   - Wrong format
   - Incomplete download

2. **Decoder Function Error**
   - Check console for errors
   - Verify CRC32 checksum
   - Check decompression

**Debug Steps:**
1. Try encoding test audio first
2. Immediately decode it
3. Check if issue is with encoding or decoding

---

### **Issue 4: Download Not Working**

**Symptoms:**
- Button appears but no download
- File not in Downloads folder

**Fixes:**

1. **Check Download Location**
   ```
   Press Ctrl+J in Chrome to open Downloads
   Look in: C:\Users\[YourName]\Downloads\
   ```

2. **Check Browser Permissions**
   - Chrome may block downloads
   - Check address bar for blocked icon
   - Allow downloads for this site

3. **Check Console for Errors**
   ```javascript
   // Should see no errors when clicking download
   ```

---

## 📊 EXPECTED BEHAVIOR

### **Encoder (Working):**
```
1. Upload audio file
   ↓
2. Show "Analyzing audio..." (10%)
   ↓
3. Show analysis progress (10-40%)
   ↓
4. Show "Converting to PCM..." (45%)
   ↓
5. Show "Applying delta encoding..." (60%)
   ↓
6. Show "Compressing data..." (80%)
   ↓
7. Show "Complete!" (100%)
   ↓
8. Display results with instruments, BPM, key, etc.
   ↓
9. Show "📥 Download File" button
   ↓
10. Click downloads .niv file to Downloads folder
```

### **Decoder (Working):**
```
1. Upload .NIV file
   ↓
2. Show file info (channels, sample rate, etc.)
   ↓
3. Click "Decode to Audio"
   ↓
4. Show "Decompressing data..." (20%)
   ↓
5. Show "Decoding .NIV file..." (50%)
   ↓
6. Show "Converting to audio format..." (80%)
   ↓
7. Show "Complete!" (100%)
   ↓
8. Display decoded info
   ↓
9. Show "📥 Download File" button
   ↓
10. Click downloads WAV file to Downloads folder
```

---

## 🧪 TEST SCENARIOS

### **Test 1: Function Availability**
```javascript
// Open browser console and paste:
const tests = [
    'analyzeAudio',
    'detectBPM',
    'detectMusicalKey',
    'classifyGenre',
    'classifyMood',
    'detectVocals',
    'encodeToNIV',
    'decodeFromNIV',
    'getNIVInfo',
    'audioBufferToWav'
];

tests.forEach(f => {
    console.log(f + ':', typeof window[f]);
});

// All should show "function"
```

### **Test 2: Encode Test Audio**
```javascript
// This is what encoder-decoder-test.html does automatically
// It generates a 440 Hz sine wave and encodes it
```

### **Test 3: Full Cycle**
```
1. Open encoder-decoder-test.html
2. Click "Test Encoder"
3. Wait for success
4. Click "Test Decoder"
5. Verify lossless (max diff < 0.0001)
```

---

## ✅ VERIFICATION CHECKLIST

### **Before Upload:**
- [ ] Open index.html in Chrome
- [ ] Press F12 to open console
- [ ] Check for any red errors
- [ ] All scripts should load (check Network tab)

### **During Upload:**
- [ ] File uploads successfully
- [ ] Audio decodes (Web Audio API)
- [ ] File info displays
- [ ] "Encode" button becomes enabled

### **During Encoding:**
- [ ] Progress bar appears
- [ ] Progress updates from 10% to 100%
- [ ] No console errors
- [ ] Analysis completes

### **After Encoding:**
- [ ] Success message appears
- [ ] All analysis data shown (instruments, BPM, key, etc.)
- [ ] Download button appears
- [ ] File size and compression ratio shown

### **Download:**
- [ ] Click download button
- [ ] File appears in Downloads folder
- [ ] File has .niv extension
- [ ] File size matches displayed size

### **Decoding:**
- [ ] Upload .NIV file in Decode tab
- [ ] File info displays
- [ ] Click "Decode to Audio"
- [ ] Progress bar shows
- [ ] Success message appears
- [ ] Download button appears
- [ ] WAV file downloads correctly
- [ ] Audio plays correctly

---

## 🔍 DEBUGGING COMMANDS

### **Check Function Availability:**
```javascript
console.log('Functions:', {
    analyzeAudio: typeof analyzeAudio,
    encodeToNIV: typeof encodeToNIV,
    decodeFromNIV: typeof decodeFromNIV
});
```

### **Check Audio Context:**
```javascript
const ctx = new (window.AudioContext || window.webkitAudioContext)();
console.log('AudioContext:', ctx);
console.log('Sample Rate:', ctx.sampleRate);
```

### **Check Compression API:**
```javascript
console.log('CompressionStream:', typeof CompressionStream);
console.log('DecompressionStream:', typeof DecompressionStream);
```

### **Test Encode Function:**
```javascript
// Generate test audio
const ctx = new AudioContext();
const buffer = ctx.createBuffer(2, 44100, 44100);
for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
    }
}

// Try encoding
encodeToNIV(buffer, {test: true}, null)
    .then(result => console.log('Encode success:', result))
    .catch(err => console.error('Encode error:', err));
```

---

## 📞 QUICK REFERENCE

| Problem | Check | Solution |
|---------|-------|----------|
| Functions undefined | Console, module-test.html | Reload page, check scripts |
| No progress | Console errors | Check analyzeAudio function |
| No download button | Console errors | Check encodeToNIV result |
| File not downloading | Ctrl+J in Chrome | Check Downloads folder |
| Decode fails | Console errors | Check .NIV file validity |
| Wrong output format | Code | Only WAV supported currently |

---

## 🎯 NEXT STEPS

1. **Run encoder-decoder-test.html**
   - This will test everything automatically
   - Check execution log for details

2. **If tests pass:**
   - Encoder and decoder are working!
   - Issue is likely with UI or file handling
   - Check browser console for UI errors

3. **If tests fail:**
   - Check which test fails
   - Read error message in execution log
   - Check browser console for details

4. **Report Results:**
   - Which test failed?
   - What error message?
   - Screenshot of execution log?

---

## 🚀 EXPECTED STATUS

If everything is working:

```
✅ All 10 functions available
✅ Encoder creates .NIV file
✅ Decoder restores audio
✅ Lossless verification passes
✅ Downloads work
✅ Full cycle successful
```

**Open encoder-decoder-test.html to verify!**
