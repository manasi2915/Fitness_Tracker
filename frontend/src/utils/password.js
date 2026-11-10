// Password rules shared by sign-up and change-password (the backend enforces the same rules)
export function passwordRules(pw) {
    return [
        { label: 'At least 8 characters', ok: pw.length >= 8 },
        { label: 'A letter', ok: /[A-Za-z]/.test(pw) },
        { label: 'A number', ok: /\d/.test(pw) }
    ];
}
