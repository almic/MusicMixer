/*

Demonstration of the accuracy for values in the Float32Array, used by the AudioBuffer.

 */

const MAX_32_INT = 2 ** 32;
const MAX_32_FLOAT_INT = 2 ** 24;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

/**
 * Converts the two numbers to a system Float32 and then compares them.
 * A positive value means the first number is greater than the second, a negative
 * value is the opposite, and 0 means they are equal.
 * @param x number
 * @param y number
 * @returns -1, 0, or 1
 */
function compare32float(x: number, y: number): -1 | 0 | 1 {
    const array = new Float32Array(2);
    array[0] = x;
    array[1] = y;

    return array[0] > array[1] ? 1 : array[1] > array[0] ? -1 : 0;
}

/**
 * Converts the input to a 32-bit float, then returns it
 * @param x number
 * @returns converted number
 */
function convert32float(x: number): number {
    const array = new Float32Array(1);
    array[0] = x;
    return array[0];
}

console.log(`1 < 2  : ${compare32float(1, 2) < 0}`);
console.log(`2 > 1  : ${compare32float(2, 1) > 0}`);
console.log(`1 == 1 : ${compare32float(1, 1) == 0}`);

console.log(
    `${MAX_32_FLOAT_INT} == ${MAX_32_FLOAT_INT + 1} : ${
        compare32float(MAX_32_FLOAT_INT, MAX_32_FLOAT_INT + 1) == 0
    }`,
);

console.log(
    `${-MAX_32_FLOAT_INT} == ${-MAX_32_FLOAT_INT + 1} : ${
        compare32float(-MAX_32_FLOAT_INT, -MAX_32_FLOAT_INT + 1) == 0
    }`,
);

console.log(
    `${-MAX_32_FLOAT_INT - 1} == ${-MAX_32_FLOAT_INT} : ${
        compare32float(-MAX_32_FLOAT_INT - 1, -MAX_32_FLOAT_INT) == 0
    }`,
);

console.log(`${MAX_32_INT} to 32 float = ${convert32float(MAX_32_INT)}`);
console.log(`${MAX_SAFE_INTEGER} to 32 float = ${convert32float(MAX_SAFE_INTEGER)}`);

console.log('\nConclusions:');
console.log(
    `Effective integer range with 32Float: ${-MAX_32_FLOAT_INT} to ${MAX_32_FLOAT_INT}, ${
        MAX_32_FLOAT_INT * 2
    } range.`,
);
console.log(`Best 44.1k supported duration: ${(MAX_32_FLOAT_INT * 2) / 44100} seconds.`);
console.log(`Best 88.2k supported duration: ${(MAX_32_FLOAT_INT * 2) / 88100} seconds.`);
