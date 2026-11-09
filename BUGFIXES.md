# NIV Audio Codec - Bug Fixes

## Version 1.0.1 - Bug Fix Release

### Bugs Fixed

#### 1. **Function Name Collision (Critical)**
**Location:** `app.js`
**Issue:** The application functions `encodeToNIV()` and `decodeFromNIV()` had the same names as the codec functions in `niv-codec.js`, causing recursive calls and stack overflow.

**Fix:** 
- Renamed `app.js` functions to `processEncode()` and `processDecode()`
- Updated HTML onclick handlers to call the correct functions
- Added clear comments distinguishing app logic from codec logic

#### 2. **Event Parameter Missing (High)**
**Location:** `app.js` - `switchTab()` function
**Issue:** Function used `event` object without it being passed as a parameter, causing ReferenceError in strict mode.

**Fix:**
- Added `event` parameter to `switchTab(tabName, event)` function
- Added null checks for event object
- Updated HTML onclick handlers to pass `event`
- Added fallback logic for when event is not available

#### 3. **Buffer Alignment Issues (High)**
**Location:** `niv-codec.js` - Delta encoding/decoding
**Issue:** Creating Int32Array views directly from Uint8Array.buffer could cause alignment issues on some platforms, leading to corrupted data.

**Fix:**
- Added proper buffer copying in `encodeToNIV()`:
  ```javascript
  const deltaBuffer = new ArrayBuffer(deltaEncoded.length * 4);
  const deltaView = new Uint8Array(deltaBuffer);
  const deltaSource = new Uint8Array(deltaEncoded.buffer, deltaEncoded.byteOffset, deltaEncoded.byteLength);
  deltaView.set(deltaSource);
  ```
- Added proper buffer alignment in `decodeFromNIV()`:
  ```javascript
  const alignedBuffer = new ArrayBuffer(deltaBytes.length);
  const alignedView = new Uint8Array(alignedBuffer);
  alignedView.set(deltaBytes);
  const deltaEncoded = new Int32Array(alignedBuffer);
  ```

#### 4. **Missing Error Handling (Medium)**
**Location:** `niv-codec.js` - Compression/decompression functions
**Issue:** No try-catch blocks around compression/decompression operations, causing unhandled promise rejections.

**Fix:**
- Added comprehensive try-catch blocks
- Added detailed error messages
- Added console.error logging for debugging

#### 5. **Missing Input Validation (Medium)**
**Location:** `niv-codec.js` - `decodeFromNIV()` function
**Issue:** No validation of file size or header values before processing, could cause crashes with malformed files.

**Fix:**
- Added file size validation
- Added range checks for channels (1-32) and sample rate (8000-192000 Hz)
- Added bounds checking for metadata and audio data sections
- Added clear error messages for each validation failure

#### 6. **Browser Compatibility Detection Missing (Low)**
**Location:** `app.js`
**Issue:** No check for required browser APIs, leading to cryptic errors on unsupported browsers.

**Fix:**
- Added DOMContentLoaded event handler
- Added compatibility checks for:
  - CompressionStream API
  - DecompressionStream API
  - Web Audio API
- Added console logging with styled output
- Added `showGlobalError()` function for compatibility issues

### Testing Improvements

#### Created `test.html`
Comprehensive test page with:
- API compatibility checks
- Unit tests for delta encoding
- Unit tests for CRC32 checksum
- Unit tests for compression/decompression
- Full integration test (generate → encode → decode → verify)
- Visual pass/fail indicators
- Detailed test output

### Files Modified

1. **app.js**
   - Fixed function name collisions
   - Fixed event parameter handling
   - Added browser compatibility checks
   - Added styled console logging

2. **niv-codec.js**
   - Fixed buffer alignment issues
   - Added comprehensive error handling
   - Added input validation
   - Added try-catch blocks throughout

3. **index.html**
   - Updated onclick handlers to pass event parameter
   - Updated function names (processEncode, processDecode)

4. **test.html** (New)
   - Complete test suite for debugging
   - Visual test results
   - Integration testing

### How to Test

1. Open `test.html` in Chrome
2. Run all unit tests (should all pass)
3. Run integration test (should pass with lossless verification)
4. Open `index.html` for the main application
5. Try encoding an audio file
6. Try decoding the .NIV file
7. Check browser console (F12) for any errors

### Browser Requirements

- **Chrome/Edge 80+** (for CompressionStream API)
- **Any modern browser** with Web Audio API support

### Known Limitations

1. Output format is currently limited to WAV (32-bit float)
   - FLAC/MP3 export requires additional codec libraries
2. Large files (>100MB) may be slow due to browser memory constraints
3. Some older audio formats may not be supported by Web Audio API

### Future Improvements

1. Add Web Worker support for background processing
2. Add FLAC encoder for lossless output
3. Add progress callbacks for large file encoding
4. Add batch processing support
5. Add audio visualization during playback

## Verification Checklist

- [x] All function name collisions resolved
- [x] Event handling fixed
- [x] Buffer alignment issues fixed
- [x] Error handling added
- [x] Input validation added
- [x] Browser compatibility checks added
- [x] Test suite created
- [x] All tests passing
- [x] No console errors on page load
- [x] Encode/decode cycle works correctly

## Version History

- **1.0.0** - Initial release (with bugs)
- **1.0.1** - Bug fix release (current)
