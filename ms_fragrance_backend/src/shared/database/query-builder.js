
export class QueryBuilder {
    constructor() {
        this.conditions = [];
        this.values = [];
    }

    add(sql, value) {
        const placeholder = `$${this.values.length + 1}`;

        this.conditions.push(
            sql.replace('?', placeholder)
        );

        this.values.push(value);

        return this;
    }

    addIn(column, items = []) {
        if (!Array.isArray(items) || items.length === 0) {
            return this;
        }

        const placeholders = items.map(
            (_, index) => `$${this.values.length + index + 1}`
        );

        this.conditions.push(
            `${column} IN (${placeholders.join(', ')})`
        );

        this.values.push(...items);

        return this;
    }

    addBoolean(column, value) {
        if (value === undefined) {
            return this;
        }

        return this.add(`${column} = ?`, value);
    }

    addRange(column, min, max) {
        if (min !== undefined) {
            this.add(`${column} >= ?`, min);
        }

        if (max !== undefined) {
            this.add(`${column} <= ?`, max);
        }

        return this;
    }

    addSearch(columns, value) {
        if (!value?.trim() || !columns.length) {
            return this;
        }

        const placeholder = `$${this.values.length + 1}`;

        const conditions = columns.map(
            column => `${column} ILIKE ${placeholder}`
        );

        this.conditions.push(
            `(${conditions.join(' OR ')})`
        );

        this.values.push(`%${value.trim()}%`);

        return this;
    }

    addRaw(condition) {
        this.conditions.push(condition);

        return this;
    }

    build() {
        return {
            where: this.conditions.length
                ? `WHERE ${this.conditions.join(' AND ')}`
                : '',
            values: [...this.values]
        };
    }

    addJsonbArrayOverlap(column, items = []) {
        if (!Array.isArray(items) || items.length === 0) {
            return this;
        }

        const placeholder = `$${this.values.length + 1}`;

        this.conditions.push(
            `${column} ?| ${placeholder}::text[]`
        );

        this.values.push(items.map(String));

        return this;
    }
}