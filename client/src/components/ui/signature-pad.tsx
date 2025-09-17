import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pen, Type, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  value?: string;
  onChange?: (signature: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export interface SignaturePadRef {
  clear: () => void;
  getSignature: () => string;
  setSignature: (signature: string) => void;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ value = '', onChange, className = '', placeholder = 'Your signature', disabled = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [typedSignature, setTypedSignature] = useState('');
    const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');
    const [hasDrawing, setHasDrawing] = useState(false);

    // Initialize from value prop
    useEffect(() => {
      if (value) {
        if (value.startsWith('data:image')) {
          // It's a drawn signature
          setActiveTab('draw');
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                setHasDrawing(true);
              }
            };
            img.src = value;
          }
        } else {
          // It's a typed signature
          setActiveTab('type');
          setTypedSignature(value);
        }
      }
    }, [value]);

    const setupCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
      }
    };

    useEffect(() => {
      setupCanvas();
      window.addEventListener('resize', setupCanvas);
      return () => window.removeEventListener('resize', setupCanvas);
    }, []);

    const getMousePos = (e: MouseEvent | TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      if (disabled) return;
      
      e.preventDefault();
      setIsDrawing(true);
      const pos = getMousePos(e);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing || disabled) return;
      
      e.preventDefault();
      const pos = getMousePos(e);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        setHasDrawing(true);
      }
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      
      // Get the signature as base64
      const canvas = canvasRef.current;
      if (canvas && hasDrawing) {
        const signature = canvas.toDataURL('image/png');
        onChange?.(signature);
      }
    };

    const clearCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          setHasDrawing(false);
          onChange?.('');
        }
      }
    };

    const clearTyped = () => {
      setTypedSignature('');
      onChange?.('');
    };

    const handleTypedChange = (text: string) => {
      setTypedSignature(text);
      onChange?.(text);
    };

    const getCurrentSignature = () => {
      if (activeTab === 'draw' && hasDrawing) {
        return canvasRef.current?.toDataURL('image/png') || '';
      } else if (activeTab === 'type' && typedSignature) {
        return typedSignature;
      }
      return '';
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (activeTab === 'draw') {
          clearCanvas();
        } else {
          clearTyped();
        }
      },
      getSignature: getCurrentSignature,
      setSignature: (signature: string) => {
        if (signature.startsWith('data:image')) {
          setActiveTab('draw');
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                setHasDrawing(true);
              }
            };
            img.src = signature;
          }
        } else {
          setActiveTab('type');
          setTypedSignature(signature);
        }
      }
    }), [activeTab, hasDrawing, typedSignature]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.addEventListener('mousedown', startDrawing);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stopDrawing);
      canvas.addEventListener('mouseout', stopDrawing);
      
      canvas.addEventListener('touchstart', startDrawing);
      canvas.addEventListener('touchmove', draw);
      canvas.addEventListener('touchend', stopDrawing);

      return () => {
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);
        canvas.removeEventListener('mouseout', stopDrawing);
        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
      };
    }, [isDrawing, disabled, hasDrawing]);

    return (
      <div className={cn('w-full', className)}>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'draw' | 'type')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draw" className="flex items-center gap-2" disabled={disabled}>
              <Pen className="h-4 w-4" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="type" className="flex items-center gap-2" disabled={disabled}>
              <Type className="h-4 w-4" />
              Type
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="draw" className="space-y-2">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className={cn(
                  'w-full h-20 border border-input rounded-md bg-background cursor-crosshair',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
                style={{ touchAction: 'none' }}
              />
              {!hasDrawing && !disabled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground text-sm">
                  Draw your signature here
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearCanvas}
              disabled={disabled || !hasDrawing}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </TabsContent>
          
          <TabsContent value="type" className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor="typed-signature">Type your name</Label>
              <Input
                id="typed-signature"
                value={typedSignature}
                onChange={(e) => handleTypedChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="font-cursive text-lg"
                style={{ fontFamily: 'cursive' }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearTyped}
              disabled={disabled || !typedSignature}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';

export { SignaturePad };