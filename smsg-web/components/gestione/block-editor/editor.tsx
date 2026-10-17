"use client";

import "@blocknote/mantine/style.css";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultStyleSpecs,
  createHeadingBlockSpec,
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core";
import { it } from "@blocknote/core/locales";
import {
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  FilePanel,
  FilePanelController,
  UploadTab,
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  blockTypeSelectItems,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { MEDIA_PATH, type Block } from "@/components/posts/block-types";
import { mediaUrl } from "@/lib/media-url";
import { buttonLink, gallery, video } from "./custom-blocks";
import { UploadContext, type UploadFn } from "./upload-context";

// Whitelist = ADR-062 block types. Built-in video/audio/file/table/code/toggle/check/pageBreak are left out.
const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: createHeadingBlockSpec({
      levels: [1, 2, 3],
      allowToggleHeadings: false,
    }),
    quote: defaultBlockSpecs.quote,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    image: defaultBlockSpecs.image,
    divider: defaultBlockSpecs.divider,
    gallery,
    video,
    buttonLink,
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
  },
});

const SLASH_KEEP = new Set([
  "paragraph",
  "heading",
  "heading_2",
  "heading_3",
  "quote",
  "numbered_list",
  "bullet_list",
  "image",
  "divider",
]);

function UploadPanel({ blockId }: { blockId: string }) {
  const [, setLoading] = useState(false);
  return <UploadTab blockId={blockId} setLoading={setLoading} />;
}

type Ed = typeof schema.BlockNoteEditor;

export default function BlockEditor({
  initialBlocks,
  onChange,
  upload,
}: {
  initialBlocks?: Block[];
  onChange: (blocks: Block[]) => void;
  upload: UploadFn;
}) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: it,
    initialContent: initialBlocks?.length
      ? (initialBlocks as never)
      : undefined,
    // Stored content holds bucket paths only (ADR-062).
    resolveFileUrl: async (u) => (MEDIA_PATH.test(u) ? mediaUrl(u) : u),
    uploadFile: (f) => upload(f, "image"),
  });

  const custom = (e: Ed) =>
    [
      ["Galleria di foto", "gallery"],
      ["Video", "video"],
      ["Pulsante con collegamento", "buttonLink"],
    ].map(([title, type]) => ({
      title,
      key: type,
      group: "Altri blocchi",
      aliases: [type],
      onItemClick: () => insertOrUpdateBlockForSlashMenu(e, { type } as never),
    }));

  return (
    <UploadContext.Provider value={upload}>
      <BlockNoteView
        editor={editor}
        theme="light"
        formattingToolbar={false}
        slashMenu={false}
        onChange={() => onChange(editor.document as unknown as Block[])}
      >
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              <BlockTypeSelect
                items={blockTypeSelectItems(editor).filter((i) =>
                  [
                    "paragraph",
                    "heading",
                    "quote",
                    "bulletListItem",
                    "numberedListItem",
                  ].includes(i.type),
                )}
              />
              <BasicTextStyleButton basicTextStyle="bold" />
              <BasicTextStyleButton basicTextStyle="italic" />
              <BasicTextStyleButton basicTextStyle="underline" />
              <CreateLinkButton />
            </FormattingToolbar>
          )}
        />
        {/* Only uploaded files: stored image urls must be MediaPaths, so no "embed link" tab. */}
        <FilePanelController
          filePanel={(p) => (
            <FilePanel
              {...p}
              tabs={[
                {
                  name: it.file_panel.upload.title,
                  tabPanel: <UploadPanel blockId={p.blockId} />,
                },
              ]}
            />
          )}
        />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (q) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor).filter((i) =>
                  SLASH_KEEP.has((i as unknown as { key: string }).key),
                ),
                ...custom(editor as unknown as Ed),
              ] as never[],
              q,
            )
          }
        />
      </BlockNoteView>
    </UploadContext.Provider>
  );
}
