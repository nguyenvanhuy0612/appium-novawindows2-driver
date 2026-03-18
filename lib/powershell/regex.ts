import { errors } from '@appium/base-driver';

const MAGIC_UNICODE_REPLACEMENT_CHAR = '\uF000';
const BEGIN_OF_STATEMENT_REGEX = '(?<![.:-])';

export class RegexItem {
    private value: string;

    constructor(value: string) {
        this.value = value;
    }

    build(): string {
        if (this.value.includes(MAGIC_UNICODE_REPLACEMENT_CHAR)) {
            throw new Error(`There are missing parameters in the regex.`);
        }

        return this.value;
    }

    toRegex(flags?: string): RegExp {
        return RegExp(this.build(), flags);
    }
}

export class VarArgsRegexMatcher extends RegexItem {
    constructor(value: RegexItem) {
        super(`((?:${value.build()})(?:\\s*,\\s*${value.build()})*)`);
    }
}

export class ConstructorRegexMatcher extends RegexItem {
    constructor(fullyQualifiedName: string, ...params: RegexItem[]) {
        assertCorrectNamespace(fullyQualifiedName);

        const mainClass = fullyQualifiedName.toLowerCase().split('.').pop() ?? '';

        const regexString = `${BEGIN_OF_STATEMENT_REGEX}(?:(?:\\bnew\\s+)?(?:${mainClass}))`;

        super(`${regexString}\\(\\s*${params.map((param) => param.build()).join('\\s*,\\s*')}\\s*\\)`);
    }
}

export class PropertyRegexMatcher extends RegexItem {
    constructor(namespace: string, ...properties: string[]) {
        assertCorrectNamespace(namespace);

        const propertiesRegex = properties.length > 0
            ? `(?<![a-z-.])(?:(?:${properties.join(')|(?:')}))(?![a-z-.])`
            : '(?:\\b[a-z]+)';

        super(`${BEGIN_OF_STATEMENT_REGEX}(${propertiesRegex}(?![.-]))`.toLowerCase());
    }
}

export class StringRegexMatcher extends RegexItem {
    constructor() {
        super(`('(?:[^']*(?:''[^']*)?)*')`);
    }
}

function assertCorrectNamespace(namespace: string): void {
    if (!/[a-z.()?:]*/i.test(namespace)) {
        throw new errors.InvalidArgumentError('namespace parameter should consist of only alphabetical latin letters and dots.');
    }
}