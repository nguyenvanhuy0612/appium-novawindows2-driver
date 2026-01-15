import { $ } from '../util';

export class PSObject {
    private readonly command: string;

    constructor(command: string) {
        this.command = command;
    }

    toString(): string {
        return this.command;
    }
}

export function pwsh(strings: TemplateStringsArray, ...values: string[]): string {
    let command = strings.reduce((result, str, i) => result + str + (i < values.length ? values[i] : ''), '');
    // Remove comments
    command = command.replace(/<#[\s\S]*?#>/g, ''); // Block comments
    command = command.replace(/(#.*$)/gm, ''); // Line comments
    // Normalize whitespace
    command = command.replace(/\s+/g, ' ').trim();
    return /* ps1 */ `(Invoke-Expression -Command ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${btoa(command)}'))))`;
}

export function pwsh$(literals: TemplateStringsArray, ...substitutions: number[]) {
    const templateInstance = $(literals, ...substitutions);
    const defaultFormat = templateInstance.format.bind(templateInstance);
    templateInstance.format = (...args: any[]) => {
        let command = defaultFormat(...args);
        // Remove comments
        command = command.replace(/<#[\s\S]*?#>/g, ''); // Block comments
        command = command.replace(/(#.*$)/gm, ''); // Line comments
        // Normalize whitespace
        command = command.replace(/\s+/g, ' ').trim();
        return /* ps1 */ `(Invoke-Expression -Command ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${btoa(command)}'))))`;
    };

    return templateInstance;
}

export function decodePwsh(command: string): string {
    const pattern = /Invoke\-Expression \-Command \(\[System\.Text\.Encoding\]::UTF8\.GetString\(\[System\.Convert\]::FromBase64String\('([A-Za-z0-9\+\/\=]+)'\)\)\)/;
    for (let i = 0; i < 10; i++) {
        const match = command.match(pattern);
        if (match?.[1]) {
            command = command.replaceAll(match[0], atob(match[1]));
        } else {
            break;
        }
    }
    return command;
}