import { describe, it, expect } from 'vitest';
import { validateSeoSettings, isValidRoutePath, isValidOptionalUrl } from '../seoValidator';

describe('seoValidator', () => {
    it('returns no errors for valid minimal create payload', () => {
        const errors = validateSeoSettings({ page_type: 'shop', route_path: '/shop' }, { isUpdate: false });
        expect(errors).toEqual([]);
    });

    it('requires page_type and route_path on create', () => {
        const errors = validateSeoSettings({}, { isUpdate: false });
        expect(errors.join(' ')).toMatch(/page_type/);
        expect(errors.join(' ')).toMatch(/route_path/);
    });

    it('trims/validates route_path format', () => {
        expect(isValidRoutePath('/shop')).toBe(true);
        expect(isValidRoutePath('shop')).toBe(false);
        expect(isValidRoutePath('/a b')).toBe(false);
    });

    it('validates optional urls', () => {
        expect(isValidOptionalUrl('')).toBe(true);
        expect(isValidOptionalUrl('https://example.com')).toBe(true);
        expect(isValidOptionalUrl('not-a-url')).toBe(false);
    });

    it('rejects too-long title and description', () => {
        const errors = validateSeoSettings({
            page_type: 'shop', route_path: '/shop',
            seo_title: 'a'.repeat(61),
            meta_description: 'b'.repeat(161),
        });
        expect(errors.join(' ')).toMatch(/SEO title is too long/);
        expect(errors.join(' ')).toMatch(/Meta description is too long/);
    });

    it('validates robots and twitter_card enums', () => {
        const errors = validateSeoSettings({
            page_type: 'shop', route_path: '/shop',
            robots: 'nope', twitter_card: 'nope',
        });
        expect(errors.join(' ')).toMatch(/Invalid robots/);
        expect(errors.join(' ')).toMatch(/Invalid twitter_card/);
    });

    it('validates structured_data', () => {
        const errors = validateSeoSettings({
            page_type: 'shop', route_path: '/shop',
            structured_data: 'not json',
        });
        expect(errors.join(' ')).toMatch(/structured_data/);
    });

    it('allows update without required fields', () => {
        const errors = validateSeoSettings({ seo_title: 'Hi' }, { isUpdate: true });
        expect(errors).toEqual([]);
    });
});