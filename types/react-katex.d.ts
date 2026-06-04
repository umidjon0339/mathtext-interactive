declare module 'react-katex' {
  import { FC } from 'react';

  export interface InlineMathProps {
    math: string;
    renderError?: (error: Error) => JSX.Element;
  }

  export interface BlockMathProps {
    math: string;
    renderError?: (error: Error) => JSX.Element;
  }

  export const InlineMath: FC<InlineMathProps>;
  export const BlockMath: FC<BlockMathProps>;
}