import { Platform, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { PrimitiveTextInput } from '@/components/ui/primitives';

export type InputProps = TextInputProps & {
  className?: string;
};

export function Input({ className, editable = true, allowFontScaling = true, ...props }: InputProps) {
  return (
    <PrimitiveTextInput
      className={cn(
        'dark:bg-input/30 border-input bg-card text-foreground flex min-h-12 w-full min-w-0 flex-row items-center rounded-xl border px-4 py-3 text-base leading-5 shadow-sm shadow-black/5',
        editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
          native: 'placeholder:text-muted-foreground/50',
        }),
        className
      )}
      editable={editable}
      allowFontScaling={allowFontScaling}
      accessibilityState={{ disabled: editable === false }}
      {...props}
    />
  );
}
