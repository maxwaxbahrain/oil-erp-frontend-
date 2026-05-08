import { useRef, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
    value: string;
    onChange: (signature: string) => void;
}

export default function SignaturePad({ value, onChange }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2; // Retina display support
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        // Set drawing style
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Load existing signature if any
        if (value) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
                setHasSignature(true);
            };
            img.src = value;
        }
    }, [value]);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        setHasSignature(true);

        const rect = canvas.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsDrawing(false);

        // Save signature as base64
        const signature = canvas.toDataURL('image/png');
        onChange(signature);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
        onChange('');
    };

    return (
        <div className="space-y-3">
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 cursor-crosshair touch-none"
                    style={{ touchAction: 'none' }}
                />
                {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-gray-400 text-sm font-semibold">Sign here with your finger</p>
                    </div>
                )}
            </div>

            {hasSignature && (
                <button
                    type="button"
                    onClick={clearSignature}
                    className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2"
                >
                    <RotateCcw size={18} />
                    CLEAR & RETRY
                </button>
            )}
        </div>
    );
}
