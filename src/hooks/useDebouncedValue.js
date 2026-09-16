/**
 * useDebouncedValue.js
 *
 * Generic debounce hook. Returns a debounced copy of `value` that
 * only updates after `delay` ms of inactivity.
 *
 * Works for any value type: string, number, object, etc.
 */

import { useState, useEffect } from 'react';

/**
 * @param {*} value - The value to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @returns {*} The debounced value.
 */
export function useDebouncedValue(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
