import type { User, getCloudApiClient } from "$lib/backend/cloud"

enum MessageRole {
    User = 'user',
    System = 'system'
}

export interface PromptMessage {
    content: string
    role: MessageRole
}

const commitTemplate = `
Please could you write a commit message for my changes.
Explain what were the changes and why the changes were done.
Focus the most important changes.
Use the present tense.
Always use semantic commit prefixes.
Hard wrap lines at 72 characters.
%{brief_style}
%{emoji_style}

Here is my diff:
%{diff}
`

const branchTemplate = `
Please could you write a branch name for my changes.
A branch name represent a brief description of the changes in the diff (branch).
Branch names should contain no whitespace and instead use dashes to separate words.
Branch names should contain a maximum of 5 words.

Here is my diff:
%{diff}
`

interface AIProvider {
    evaluate(prompt: string): Promise<string>
}

export class ButlerAIProvider {
    constructor(private cloud: ReturnType<typeof getCloudApiClient>, private user: User) {}

    async evaluate(prompt: string) {
        const messages: PromptMessage[] = [
            { role: MessageRole.User, content: prompt }
        ]

        const response = await this.cloud.summarize.evaluatePrompt(this.user.access_token, { messages })

        return response.message
    }
}

export class Summarizer {
    constructor(private aiProvider: AIProvider) {}

    async commit(diff: string, useEmojiStyle: boolean, useBreifStyle: boolean) {
        const briefStyle = "The commit message must be only one sentence and as short as possible."
        const emojiStyle = "Make use of GitMoji in the title prefix."
        const emojiStyleDisabled = "Don't use any emoji."

        let prompt = commitTemplate.replaceAll("%{diff}", diff.slice(0, 20000))
        if (useBreifStyle) {
            prompt = prompt.replaceAll("%{brief_style}", briefStyle)
        }
        if (useEmojiStyle) {
            prompt = prompt.replaceAll("%{emoji_style}", emojiStyle)
        } else {
            prompt = prompt.replaceAll("%{emoji_style}", emojiStyleDisabled)
        }
        prompt.replaceAll("%{breif_style}", "")

        let message = await this.aiProvider.evaluate(prompt)

        if (useBreifStyle) {
            message = message.split("\n")[0]
        }

        // trim and format output
        const firstNewLine = message.indexOf('\n');
        const summary = firstNewLine > -1 ? message.slice(0, firstNewLine).trim() : message;
        const description = firstNewLine > -1 ? message.slice(firstNewLine + 1).trim() : '';

        return description.length > 0 ? `${summary}\n\n${description}` : summary;
    }

    async branch(diff: string) {
        const prompt = branchTemplate.replaceAll("%{diff}", diff.slice(0, 20000))

        let message = await this.aiProvider.evaluate(prompt)

        message = message.replaceAll(" ", "-")
        message = message.replaceAll("\n", "-")
        return message
    }
}
