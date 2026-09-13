import * as React from 'react';
export declare function cn(...a: Array<string | false | null | undefined>): string;
export declare function Button({ className, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive';
    size?: 'default' | 'sm' | 'icon' | 'lg';
}): React.JSX.Element;
export declare function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element;
export declare function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element;
export declare function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element;
export declare function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element;
export declare function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element;
export declare function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'secondary' | 'outline' | 'success' | 'destructive';
}): React.JSX.Element;
export declare function Input(props: React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element;
export declare function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element;
export declare function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>): React.JSX.Element;
export declare function Separator({ className, orientation, ...props }: React.HTMLAttributes<HTMLDivElement> & {
    orientation?: 'horizontal' | 'vertical';
}): React.JSX.Element;
//# sourceMappingURL=ui.d.ts.map