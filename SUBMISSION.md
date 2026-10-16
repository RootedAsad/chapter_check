# ChapterCheck: submission notes

## Live link

**https://YOUR-APP.vercel.app** (replace after deploying; steps are in README.md > Deployment)

Free, no sign-up. Paste a chapter, see its Flesch Reading Ease score, and see the five hardest sentences highlighted in the text.

## AI tools used

- **Claude (Claude Code, Claude Sonnet 5.5):** wrote the React client, Express API, readability engine, tests and docs.
- **Playwright + headless Chromium:** used to load the built app, click through the sample flow and check for console errors on desktop and mobile widths.
- Add any other tools you used yourself (for example an AI image or copy tool) here.

## One place the AI got it wrong

The first version of the syllable counter looked right on typical words but miscounted common ones: "played" came out as 2 syllables and "something" as 3. That mattered because syllables feed both the Flesch score and the hardest-sentence ranking. The ranking was wrong in a visible way too: the 4-word line `"Something's wrong," Mara said.` appeared as the 4th hardest sentence in a chapter that also contained a 66-word sentence, because one 3-syllable word dominated a very short sentence. I caught both by running the engine on the sample chapter and reading the output, not by trusting the tests the AI had planned. Fixes: a rule for vowel + "yed" endings, an exceptions list, and scaling down the per-word difficulty factors for sentences under 12 words. A smaller slip: the AI's own test expected 34.235 for a hand-calculated Flesch value; the correct figure is 34.255.

## How I'd get the first 100 users (147 words)

I'd start where the pain is: indie authors on Reddit's r/writing and r/selfpublish, Royal Road and Wattpad. In week one I'd post a real before-and-after: a 66-word sentence highlighted by the tool, then the same sentence split, with the score change. Offering to analyze any chapter a commenter shares should bring the first 25 users, while following each community's self-promotion rules.

Next, I'd message 40 authors individually and ask for feedback rather than clicks. I'd also publish three short guides targeting searches like "check chapter readability" and "Flesch reading ease for fiction", each linking the tool.

Privacy is my strongest hook: chapters never leave the browser, so authors protecting unpublished drafts can try it safely. I'd say that plainly everywhere.

Finally, I'd add a "share my score" card so users bring their writing friends. I'd track analyses run and returning users, and talk to every returning user.
