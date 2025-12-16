import {describe, it, expect} from 'vitest';
import {pipe, when} from '../../src/utils/pipeline.js';

describe('pipe', () => {
  it('should apply transformers in sequence', () => {
    const addOne = (x: number) => x + 1;
    const double = (x: number) => x * 2;
    const pipeline = pipe(addOne, double);
    expect(pipeline(5)).toBe(12); // (5 + 1) * 2 = 12
  });

  it('should handle single transformer', () => {
    const addOne = (x: number) => x + 1;
    const pipeline = pipe(addOne);
    expect(pipeline(5)).toBe(6);
  });

  it('should handle empty pipeline', () => {
    const pipeline = pipe<number>();
    expect(pipeline(5)).toBe(5);
  });
});

describe('when', () => {
  it('should apply transformer when condition is true', () => {
    const double = (x: number) => x * 2;
    const conditionalDouble = when(true, double);
    expect(conditionalDouble(5)).toBe(10);
  });

  it('should return identity when condition is false', () => {
    const double = (x: number) => x * 2;
    const conditionalDouble = when(false, double);
    expect(conditionalDouble(5)).toBe(5);
  });

  it('should work with pipe', () => {
    const addOne = (x: number) => x + 1;
    const double = (x: number) => x * 2;
    const shouldDouble = true;
    const pipeline = pipe(addOne, when(shouldDouble, double));
    expect(pipeline(5)).toBe(12);
  });

  it('should skip transformer in pipe when false', () => {
    const addOne = (x: number) => x + 1;
    const double = (x: number) => x * 2;
    const shouldDouble = false;
    const pipeline = pipe(addOne, when(shouldDouble, double));
    expect(pipeline(5)).toBe(6);
  });
});
