# Educator authoring guide

For Educators. This guide takes you from a clip to a Learning Layer that is ready for review, on the v1 staff site (ADR-0015). It names each page and button as the screen shows it. You don't need to type any commands, apart from the one that prepares a clip.

A Learning Layer is the teaching on top of a Video:
- **Segments**: short stretches of the video, with the Fijian words and an English translation
- **Annotations**: what particular words mean
- **Activities**: practice for learners
- **The Completion Rule**: what a learner must do to finish

Learners see a Learning Layer only after it has been reviewed and published. You never publish; editors do.

## Prepare and upload the clip

1. Keep the original file in the NAISEMA Drive.
2. Make a copy that plays everywhere: H.264, 720p, two minutes at most, under 95 MB. The technical owner can do this for you, with the command in the runbook ("Media").
3. Sign in (`docs/handover/admin-guide.md`, "Sign in"), open **Media library**, choose the file and press **Upload**. Its length and shape are read as it uploads.

## Make the Video

1. Open **Content**. Under **Add something**, choose "Video in Learn", type a title, and press **Add and start writing**.
2. Choose the clip under **Footage (MP4, H.264)**, add a summary, and press **Save as version N**.
3. Press **Learning Layer**. The editor opens. The language is Standard Fijian.

## The editor

The page has the video **Preview** on one side and the form on the other. Everything you change stays on the page until you press **Save a new revision** at the bottom. Each save makes a new version of the Video, and the earlier ones are kept, so nothing is lost. A new version needs its reviews again.

Under **Show as** you can look at the preview as **Landscape** or **Vertical (phone)**. **Playhead** shows where the video is.

### Details

- **Title** and **Level** can be changed at any time.
- **Culturally sensitive: needs a Knowledge Holder's approval**: tick this if the clip includes cultural knowledge that someone else holds. It adds a Knowledge Holder Approval to the reviews (see "What review looks like").
- **Built on**: to change the Excerpt, type new **In time** and **Out time** values and press **Use these times**. Segments stay on the same moment of the video. Any that no longer fit are marked **Retimed**, and you must check them. Typing times and not pressing **Use these times** stops the save with a message.

### Make Segments

Under **Segments**, press **Add a Segment**. Each one is called Segment 1, Segment 2 and so on, and has:

- **Start** and **End** times, counted from the start of the Excerpt (or of the video). Type a time such as `1:01.250`, or press the up and down arrow keys in the field to move it a tenth of a second at a time. **Set start at playhead** and **Set end at playhead** take the time from the video. **Replay** plays just that Segment.
- **Speaker (optional)**.
- **Fijian**: the words spoken.
- **English translation**.
- **Overlaps the Segment before on purpose**: tick this only when two people really do speak at once. Otherwise overlapping times are flagged.

**Remove** deletes a Segment. **Put Segments in time order** sorts them. If you have WebVTT caption files, **Import Fijian (replaces the Segments)** and **Import English translations** (under **WebVTT**) fill the Segments in. Imported text is marked **Unreviewed draft**, and you press **I've checked this text** on each Segment once you have read it. Until you do, the Learning Layer cannot be published. **Fijian WebVTT** and **English WebVTT** download what you have saved.

### Add Annotations and Expressions

An Annotation ties words in a Segment to an **Expression**, the dictionary entry for a word or phrase that other Learning Layers can share.

1. In a Segment, under **Words to annotate**, press a word. For a phrase, press the first and then the last word.
2. Press **Annotate** with the words in quotes.
3. Under **Expression**, pick an existing one, or choose **A new Expression…** and fill in **Word or phrase**, **General meaning**, **Literal meaning (what the words say)** for an idiom, **Grammar note (optional)** and **Pronunciation guidance (optional)**.
4. In **What it means here**, say what the words mean in this clip. **Grammar note for this moment (optional)** is for anything particular to this line.
5. Tick **Add to the vocabulary list** if learners should see it in the **Vocabulary list**, then press **Add the Annotation**.

Use **Change**, **Move to the selected words** and **Remove** on an Annotation in the list below the words. If you edit a Segment's Fijian so that an annotated word moves or appears twice, the Annotation is marked and a button **It's on the right word** appears. Check it and press the button.

**Expressions** (linked at the top of **Learning Layers**) lists the whole library. You can change an Expression you added, as long as no Learning Layer you aren't assigned to uses it. If an Expression changes after you saved, the section **Updated in the library since this Learning Layer was saved** shows the old and new wording. Saving brings in the new wording, and reviewers check it.

Under each Segment and under **Notes on the whole Learning Layer** you can add a **Cultural note** or a **Context note**. Every note says **From (who the knowledge comes from)**.

### Add Activities and the Completion Rule

Under **Activities**, choose a kind beside **New Activity** and press **Add an Activity**. The kinds are **Listen and repeat**, **Comprehension (multiple choice)**, **Listening discrimination**, **What would you say next?** and **Real-world prompt**.

For each Activity:

- **Practises**: a Segment, or **The whole clip**. Listen and repeat always belongs to one Segment.
- **Prompt**: what the learner is asked.
- **Choices**, with **Correct answer** ticked on the right ones, and for some kinds a model response (**Words to repeat (Fijian)** for Listen and repeat, **Model response** for What would you say next?). Comprehension and discrimination use choices; What would you say next? takes choices, a model response, or both.
- **Feedback (shown once the learner has answered)**.
- **Pronunciation guidance (optional)** for Listen and repeat. The editor offers a suggestion from your Annotations.
- **Text alternative (how to do it without the audio or speaking)**. Speaking is never required and nothing records anyone.
- **Required for completion**: tick it if the learner must do it. A real-world prompt can't be required.

**Move up**, **Move down** and **Remove** change the order and contents.

The **Completion Rule** at the top of Activities says in words what a learner needs to finish. Learners complete a Learning Layer once they have tried each required Activity and seen its feedback. Watching alone never completes it, and a real-world prompt is never required. If it says **Nothing is required yet**, mark at least one Activity as required. Otherwise learners can never complete it, and it cannot be published.

### Preview as a learner

Press **Preview as a learner** on any Activity. It opens the Activity as a learner sees it, marked **Learner preview. Nothing here is saved or recorded.** As you try the required Activities, a line reports **In your preview: 1 of 2 required Activities done.** and finally **In your preview: the Learning Layer is complete.** **Start the preview again** clears it. **Close the preview** shuts one.

For the video itself, use **Replay** on Segments, and the caption text and annotated words shown over and beside the **Preview**.

### Things to fix

If a heading says **N things to fix**, **Annotations and notes to check** or **Activities to check**, the page lists what is wrong, with links to the field. Fix these before you save. Some problems stop the save, and the page shows the same list again with links to the fields.

## When it's ready for review

1. Press **Save a new revision**, then **Back to** the Video.
2. **Where it stands** lists, in plain words, what is still missing. That includes a Segment still marked as an unreviewed draft, a retimed Segment, an Annotation that lost its place, or no required Activity. Clear these first.
3. Once you've saved, reviewers see the version on their staff home, under **Waiting for your review**. Tell the editor it's ready.

You can't approve your own version. Someone else always does.

## A worked example

You are assigned to a 40-second video of a family greeting each other.

1. Upload the clip and make the Video (above), then press **Learning Layer**. Title it "Greeting an elder", Level **Beginner**, **Built on** the whole video.
2. Press **Add a Segment** three times. Play the video, and at the start of the first greeting press **Set start at playhead**, then at its end **Set end at playhead**. Type the Fijian and the English translation. Do the same for the other two.
3. In Segment 1, press the word *Bula*, press **Annotate “Bula”**, pick the existing Expression, and type "A warm hello to someone older" in **What it means here**. Tick **Add to the vocabulary list** and press **Add the Annotation**.
4. Under **Activities**, choose **Listen and repeat**, press **Add an Activity**, and set **Practises** to Segment 1. Tick **Required for completion**, write the **Prompt** and the **Feedback**. Add a **Comprehension (multiple choice)** Activity on the whole clip with two choices and mark one correct.
5. Press **Preview as a learner** on each, do them, and read **In your preview: the Learning Layer is complete.**
6. Press **Save a new revision**, and tell the editor it's ready for review.

## What review looks like

**Where it stands** on the Video's page lists the reviews the version needs, and each one's state: not done yet, approved, or changes asked for.

- **Language review:** every Learning Layer needs one, in Standard Fijian, by a qualified Language Reviewer. They check:
  - the words and translations
  - the Annotations and Expressions
  - that the Activities have correct answers
- **Knowledge Holder Approval:** a Learning Layer you marked culturally sensitive also needs one. An editor sends the Knowledge Holder a preview link, so they can see the words without an account, and records their approval with any conditions. Don't contact them yourself unless an editor asks you to.
- **Publishing:** an editor publishes once every review is approved and the Video's rights are recorded.

If a reviewer asks for changes, their note shows on the Video's page. Make the changes in the Learning Layer and save. The new version starts with no decisions. If you disagree, or aren't sure what a note means, ask the reviewer or an editor before you change anything.

## Where to go for help

- Wording of the staff pages and the founder's tasks: `docs/handover/admin-guide.md`.
- Something stuck, such as a clip that won't upload or play: tell the technical owner. The runbook (`docs/handover/runbook.md`) is theirs.
