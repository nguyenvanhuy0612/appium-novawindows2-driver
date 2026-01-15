let command = `
(Invoke-Expression -Command ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('KEludm9rZS1FeHByZXNzaW9uIC1Db21tYW5kIChbVGV4dC5FbmNvZGluZ106OlVURjguR2V0U3RyaW5nKFtDb252ZXJ0XTo6RnJvbUJhc2U2NFN0cmluZygnQ2lBZ0lDQWtaV3dnUFNBa1pXeGxiV1Z1ZEZSaFlteGxXeWMwTWk0eE5UQTVNalUwSjEwN0NpQWdJQ0JwWmlBb0pHNTFiR3dnTFdWeElDUmxiQ2tnZXlCeVpYUjFjbTRnSkc1MWJHd2dmUW9LSUNBZ0lIUnllU0I3Q2lBZ0lDQWdJQ0FnSkc1MWJHd2dQU0FrWld3dVEzVnljbVZ1ZEM1UWNtOWpaWE56U1dRN0NpQWdJQ0FnSUNBZ2NtVjBkWEp1SUNSbGJBb2dJQ0FnZlNCallYUmphQ0I3Q2lBZ0lDQWdJQ0FnSXlBa1pXeGxiV1Z1ZEZSaFlteGxMbEpsYlc5MlpTZ25OREl1TVRVd09USTFOQ2NwT3dvZ0lDQWdJQ0FnSUhKbGRIVnliaUFrWld3S0lDQWdJSDBLJykpKSkuR2V0Q3VycmVudFBhdHRlcm4oW1dpbmRvd1BhdHRlcm5dOjpQYXR0ZXJuKS5DbG9zZSgp'))))
`
// const raw1 = command.replaceAll(/Invoke\-Expression \-Command \(\[Text.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String\('([A-Za-z0-9]+)'\)\)\)/g, '$1')   
// console.log(`raw1: ${raw1}`)

const pattern = /Invoke\-Expression \-Command \(\[Text.Encoding\]::UTF8\.GetString\(\[Convert\]::FromBase64String\('([A-Za-z0-9]+)'\)\)\)/
// const match = command.match(pattern)
// console.log(`match: ${match}`)
// console.log(`match length: ${match?.length}`)
// console.log(`match 1: ${match?.[1]}`)
// const base64cmd = match?.[1]
// if (base64cmd) {
//     const raw = Buffer.from(base64cmd, 'base64').toString('utf-8')
//     console.log(`raw: ${raw}`)
//     const command2 = command.replaceAll(match[0], raw)
//     console.log(`command2: ${command2}`)
    
//     const match2 = command2.match(pattern)
//     const base64cmd2 = match2?.[1]
//     if (base64cmd2) {
//         const raw2 = Buffer.from(base64cmd2, 'base64').toString('utf-8')
//         console.log(`raw2: ${raw2}`)
//         const command3 = command2.replaceAll(match2[0], raw2)
//         console.log(`command3: ${command3}`)
//     }
// }

for (let i = 0; i < 10; i++) {
    const match = command.match(pattern)
    if (match) {
        const base64cmd = match[1]
        const raw = Buffer.from(base64cmd, 'base64').toString('utf-8')
        command = command.replaceAll(match[0], raw)
    }
}

console.log(`command: ${command}`)