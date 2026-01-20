import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NFCScanner.css';

// TypeScript definitions for Web NFC API
interface NDEFReader {
  scan(): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((error: Event) => void) | null;
}

interface NDEFReadingEvent {
  message: NDEFMessage;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFRecord {
  recordType: string;
  data?: DataView;
  mediaType?: string;
  encoding?: string;
}

declare global {
  interface Window {
    NDEFReader?: {
      new (): NDEFReader;
    };
  }
}

export default function NFCScanner() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const navigate = useNavigate();

  // Check if Web NFC API is supported
  const checkSupport = (): boolean => {
    if (typeof window === 'undefined') return false;
    return 'NDEFReader' in window;
  };

  // Check browser support on mount
  useEffect(() => {
    setIsSupported(checkSupport());
  }, []);

  // Extract hive public_id from URL
  const extractHiveId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      // Match pattern: /h/{public_id}
      const match = urlObj.pathname.match(/^\/h\/([^\/]+)$/);
      return match ? match[1] : null;
    } catch (e) {
      // If URL parsing fails, try regex directly
      const match = url.match(/\/h\/([^\/\s]+)/);
      return match ? match[1] : null;
    }
  };

  // Decode NDEF record data
  const decodeNDEFRecord = (record: NDEFRecord): string | null => {
    if (!record.data) return null;

    try {
      // For URL records, data is typically UTF-8 encoded
      const decoder = new TextDecoder(record.encoding || 'utf-8');
      const data = new Uint8Array(record.data.buffer);
      return decoder.decode(data);
    } catch (e) {
      console.error('Failed to decode NDEF record:', e);
      return null;
    }
  };

  const handleScan = async () => {
    // Double-check support
    if (isSupported === false) {
      return;
    }

    if (isSupported === null) {
      // Still checking, wait a moment
      const supported = checkSupport();
      setIsSupported(supported);
      if (!supported) {
        setError(
          'NFC scanning is not supported in this browser. ' +
          'Please use Chrome or Edge on Android, or tap the NFC tag directly on iOS Safari.'
        );
        return;
      }
    }

    // Check if we're on HTTPS or localhost
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('NFC scanning requires HTTPS (or localhost for development)');
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const reader = new window.NDEFReader!();

      // Set up reading handler
      reader.onreading = (event: NDEFReadingEvent) => {
        try {
          const message = event.message;
          let url: string | null = null;

          // Process all records in the message
          for (const record of message.records) {
            if (record.recordType === 'url' || record.recordType === 'text') {
              const decoded = decodeNDEFRecord(record);
              if (decoded) {
                // If it's a URL record, it might have a protocol prefix
                if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
                  url = decoded;
                } else if (decoded.startsWith('0')) {
                  // NDEF URL records often have a protocol code prefix
                  // 0 = http://, 1 = https://, etc.
                  const protocolCode = decoded[0];
                  const rest = decoded.substring(1);
                  if (protocolCode === '0') {
                    url = 'http://' + rest;
                  } else if (protocolCode === '1') {
                    url = 'https://' + rest;
                  } else {
                    url = 'https://' + decoded.substring(1);
                  }
                } else {
                  // Try as-is
                  url = decoded;
                }
                break; // Use first valid URL found
              }
            } else if (record.recordType === 'empty') {
              // Skip empty records
              continue;
            }
          }

          if (!url) {
            setError('No URL found in NFC tag. Please ensure the tag contains a hive URL.');
            setScanning(false);
            return;
          }

          // Extract hive public_id from URL
          const hiveId = extractHiveId(url);
          if (!hiveId) {
            setError(
              `Invalid hive URL format: ${url}. Expected format: https://domain.com/h/{hive_id}`
            );
            setScanning(false);
            return;
          }

          // Navigate to hive page
          setScanning(false);
          navigate(`/h/${hiveId}`);
        } catch (err: any) {
          console.error('Error processing NFC tag:', err);
          setError('Failed to process NFC tag: ' + (err.message || 'Unknown error'));
          setScanning(false);
        }
      };

      // Set up error handler
      reader.onreadingerror = (error: Event) => {
        console.error('NFC reading error:', error);
        setError('Failed to read NFC tag. Please try again.');
        setScanning(false);
      };

      // Start scanning
      await reader.scan();
    } catch (err: any) {
      console.error('NFC scan error:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        setError('NFC permission denied. Please allow NFC access in your browser settings.');
      } else if (err.name === 'NotSupportedError') {
        setError('NFC is not supported on this device.');
      } else {
        setError('Failed to start NFC scan: ' + (err.message || 'Unknown error'));
      }
      setScanning(false);
    }
  };

  const handleStopScan = () => {
    setScanning(false);
    setError(null);
  };

  // If not supported, show a helpful message
  if (isSupported === false) {
    return (
      <div className="nfc-scanner">
        <button
          className="nfc-scan-button nfc-not-supported"
          disabled
          title="NFC scanning not supported in this browser"
        >
          <img src="/nfc-icon.png" alt="NFC" className="nfc-icon" />
          <span>NFC Scan</span>
        </button>
        {error && <div className="nfc-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="nfc-scanner">
      <button
        className={`nfc-scan-button ${scanning ? 'scanning' : ''}`}
        onClick={scanning ? handleStopScan : handleScan}
        disabled={scanning && false}
        title={scanning ? 'Scanning for NFC tag...' : 'Scan NFC tag to open hive'}
      >
        <img src="/nfc-icon.png" alt="NFC" className="nfc-icon" />
        <span>{scanning ? 'Scanning...' : 'Scan NFC'}</span>
        {scanning && <div className="nfc-scanning-indicator"></div>}
      </button>
      {error && <div className="nfc-error">{error}</div>}
      {scanning && (
        <div className="nfc-scanning-hint">
          Hold your device near the NFC tag...
        </div>
      )}
    </div>
  );
}
