import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateSeoSettings,
    SEO_TITLE_MAX,
    META_DESCRIPTION_MAX,
} from '../../../src/modules/seo/application/validators/seo.validator.js';

test('validateSeoSettings accepts a valid minimal homepage record', () => {
    const { errors, normalized } = validateSeoSettings({
        page_type: 'homepage',
        route_path: '/',
        seo_title: 'MS Fragrance — Home',
        meta_description: 'Pure attars and natural fragrances.',
        robots: 'index,follow',
    });

    assert.deepEqual(errors, []);
    assert.equal(normalized.page_type, 'homepage');
    assert.equal(normalized.route_path, '/');
    assert.equal(normalized.seo_title, 'MS Fragrance — Home');
    assert.equal(normalized.is_published, true);
    assert.deepEqual(normalized.structured_data, {});
});

test('validateSeoSettings trims and normalizes inputs', () => {
    const { normalized } = validateSeoSettings({
        page_type: 'shop',
        route_path: '  /shop  ',
        seo_title: '  Shop All  ',
        twitter_card: 'summary',
        product_id: '42',
    });

    assert.equal(normalized.route_path, '/shop');
    assert.equal(normalized.seo_title, 'Shop All');
    assert.equal(normalized.twitter_card, 'summary');
    assert.equal(normalized.product_id, 42);
});

test('validateSeoSettings requires page_type and route_path for create', () => {
    let threw = false;
    try {
        validateSeoSettings({ seo_title: 'x' });
    } catch (error) {
        threw = true;
        assert.ok(Array.isArray(error.details));
        assert.ok(
            error.details.some((d) => d.includes('page_type')),
            'expected a page_type detail'
        );
        assert.ok(
            error.details.some((d) => d.includes('route_path')),
            'expected a route_path detail'
        );
    }
    assert.ok(threw, 'expected validation to throw');
});

test('validateSeoSettings rejects spaces in route_path', () => {
    let threw = false;
    try {
        validateSeoSettings({
            page_type: 'homepage',
            route_path: '/my page',
        });
    } catch (error) {
        threw = true;
    }
    assert.ok(threw, 'expected route_path with spaces to be rejected');
});

test('validateSeoSettings rejects invalid page_type', () => {
    let threw = false;
    try {
        validateSeoSettings({
            page_type: 'blog',
            route_path: '/blog',
        });
    } catch (error) {
        threw = true;
    }
    assert.ok(threw, 'expected invalid page_type to be rejected');
});

test('validateSeoSettings warns when title exceeds recommended max', () => {
    const longTitle = 'A'.repeat(SEO_TITLE_MAX + 1);
    let threw = false;
    try {
        validateSeoSettings({
            page_type: 'homepage',
            route_path: '/',
            seo_title: longTitle,
        });
    } catch (error) {
        threw = true;
        assert.ok(
            error.details.some((e) => e.includes('too long')),
            'expected a title-too-long detail'
        );
    }
    assert.ok(threw, 'expected validation to throw for a long title');
});

test('validateSeoSettings warns when description exceeds recommended max', () => {
    const longDesc = 'A'.repeat(META_DESCRIPTION_MAX + 1);
    let threw = false;
    try {
        validateSeoSettings({
            page_type: 'homepage',
            route_path: '/',
            meta_description: longDesc,
        });
    } catch (error) {
        threw = true;
        assert.ok(
            error.details.some((e) => e.includes('too long')),
            'expected a description-too-long detail'
        );
    }
    assert.ok(threw, 'expected validation to throw for a long description');
});

test('validateSeoSettings rejects invalid robots directive', () => {
    let threw = false;
    try {
        validateSeoSettings({
            page_type: 'homepage',
            route_path: '/',
            robots: 'noarchive',
        });
    } catch (error) {
        threw = true;
    }
    assert.ok(threw, 'expected invalid robots to be rejected');
});

test('validateSeoSettings rejects invalid twitter_card', () => {
    let threw = false;
    try {
        validateSeoSettings({
            page_type: 'homepage',
            route_path: '/',
            twitter_card: 'huge_image',
        });
    } catch (error) {
        threw = true;
    }
    assert.ok(threw, 'expected invalid twitter_card to be rejected');
});

test('validateSeoSettings rejects invalid absolute URL fields', () => {
    let threw = false;
    try {
        validateSeoSettings({
            page_type: 'homepage',
            route_path: '/',
            canonical_url: 'not-a-url',
            og_image: 'ftp://example.com/image.png',
        });
    } catch (error) {
        threw = true;
    }
    assert.ok(threw, 'expected invalid URLs to be rejected');
});

test('validateSeoSettings accepts optional empty URLs', () => {
    const { errors } = validateSeoSettings({
        page_type: 'homepage',
        route_path: '/',
        canonical_url: '',
        og_image: '',
        twitter_image: '',
    });
    assert.deepEqual(errors, []);
});

test('validateSeoSettings parses structured_data JSON string', () => {
    const { normalized } = validateSeoSettings({
        page_type: 'homepage',
        route_path: '/',
        structured_data: '{"@type":"Organization","name":"MS Fragrance"}',
    });
    assert.equal(normalized.structured_data['@type'], 'Organization');
});

test('validateSeoSettings rejects non-object structured_data', () => {
    let threw = false;
    try {
        validateSeoSettings({
            page_type: 'homepage',
            route_path: '/',
            structured_data: ['not', 'an', 'object'],
        });
    } catch (error) {
        threw = true;
    }
    assert.ok(threw, 'expected array structured_data to be rejected');
});

test('validateSeoSettings allows updates without page_type or route_path', () => {
    const { normalized, errors } = validateSeoSettings(
        { seo_title: 'Updated title' },
        { isUpdate: true }
    );
    assert.deepEqual(errors, []);
    assert.equal(normalized.seo_title, 'Updated title');
});

test('SEO_TITLE_MAX and META_DESCRIPTION_MAX constants are sane', () => {
    assert.equal(SEO_TITLE_MAX, 60);
    assert.equal(META_DESCRIPTION_MAX, 160);
});
