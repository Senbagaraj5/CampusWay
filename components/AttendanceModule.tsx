
import React, { useRef, useState, useEffect } from 'react';
import { Location } from '../types';

interface AttendanceModuleProps {
  onSuccess: (photoUrl: string, location: Location) => void;
  onCancel: () => void;
}

const AttendanceModule: React.FC<AttendanceModuleProps> = ({ onSuccess, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    startCamera();
    fetchLocation();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 300 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setCameraActive(true);
        };
      }
    } catch (err: any) {
      console.error("Camera Error:", err);
      const errorMsg = err.name === 'NotAllowedError' 
        ? "Camera permission denied. Please enable camera in browser settings."
        : err.name === 'NotFoundError'
        ? "No camera found on this device."
        : "Failed to access camera: " + err.message;
      setCameraError(errorMsg);
      setCameraActive(false);
    }
  };

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported on this device.");
      setLocation({
        lat: 37.7749,
        lng: -122.4194,
        timestamp: Date.now()
      });
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp
        });
        setLocationError(null);
      },
      (err) => {
        console.error("Geolocation Error:", err);
        // Use fallback location
        setLocation({
          lat: 37.7749,
          lng: -122.4194,
          timestamp: Date.now()
        });
        setLocationError("Using approximate location. Enable GPS for accuracy.");
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleCapture = () => {
    if (!canvasRef.current || !location) {
      alert("Please wait for location to be detected.");
      return;
    }
    
    setIsCapturing(true);
    const context = canvasRef.current.getContext('2d');
    
    if (context && videoRef.current && cameraActive) {
      // If camera is active, capture from video
      context.drawImage(videoRef.current, 0, 0, 400, 300);
    } else {
      // Fallback: create a placeholder image
      context!.fillStyle = '#1e293b';
      context!.fillRect(0, 0, 400, 300);
      context!.fillStyle = '#ffffff';
      context!.font = 'bold 24px Arial';
      context!.textAlign = 'center';
      context!.fillText('📷', 200, 135);
      context!.font = '14px Arial';
      context!.fillText('Camera unavailable', 200, 165);
      context!.fillText(`${new Date().toLocaleTimeString()}`, 200, 185);
    }
    
    const photoUrl = canvasRef.current.toDataURL('image/jpeg');
    
    // Simulate processing
    setTimeout(() => {
      onSuccess(photoUrl, location);
      setIsCapturing(false);
    }, 1000);
  };

  const handleRetryCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    setRetryCount(retryCount + 1);
    startCamera();
  };

  const handleRetryLocation = () => {
    setLocationError(null);
    fetchLocation();
  };

  const canCheckIn = location !== null; // Allow check-in if location is available (even fallback)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
          <h2 className="text-2xl font-black">Driver Check-In</h2>
          <p className="text-sm opacity-90 mt-1">Verify your identity to start broadcast</p>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Camera Preview */}
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Camera</p>
            <div className="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden ring-4 ring-slate-100">
              {cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center text-center p-4 bg-slate-900 flex-col gap-3">
                  <div className="text-4xl">📷</div>
                  <p className="text-sm text-red-400 font-medium">{cameraError}</p>
                  <button
                    onClick={handleRetryCamera}
                    className="mt-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Retry Camera
                  </button>
                </div>
              ) : cameraActive ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-green-500 rounded text-white text-xs font-bold flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Camera On
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-center p-4 bg-slate-900 flex-col gap-3">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-slate-400">Initializing camera...</p>
                </div>
              )}
              <canvas ref={canvasRef} width="400" height="300" className="hidden" />
            </div>
          </div>

          {/* Status Indicators */}
          <div className="space-y-2">
            {/* Location Status */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
              location 
                ? 'bg-green-50 border-green-200' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                location ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
              }`}></div>
              <span className={`text-xs font-medium ${
                location ? 'text-green-700' : 'text-amber-700'
              }`}>
                {location 
                  ? `📍 Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` 
                  : 'Detecting Location...'}
              </span>
              {locationError && (
                <button
                  onClick={handleRetryLocation}
                  className="ml-auto text-xs font-bold text-amber-600 hover:text-amber-700 underline"
                >
                  Retry
                </button>
              )}
            </div>

            {locationError && (
              <p className="text-xs text-amber-600 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                ⚠️ {locationError}
              </p>
            )}
            
            {/* Time & Date Status */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
              <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
              <span className="text-xs font-medium text-blue-700">
                🕐 {new Date().toLocaleTimeString()} | {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <button 
              onClick={onCancel}
              className="px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all hover:border-slate-300"
            >
              Cancel
            </button>
            <button 
              onClick={handleCapture}
              disabled={!canCheckIn || isCapturing}
              className={`px-4 py-3 rounded-xl font-bold shadow-lg transition-all ${
                canCheckIn && !isCapturing
                  ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 active:scale-95'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isCapturing ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying...
                </div>
              ) : (
                '✓ Check In Now'
              )}
            </button>
          </div>

          {/* Help Text */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-500">
              📱 Make sure to allow camera and location permissions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceModule;
