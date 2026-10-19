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
  BlockNoteViewEditor,
  BlockTypeSelect,
  CreateLinkButton,
  FilePanel,
  FilePanelController,
  UploadTab,
  FormattingToolbar,
  SuggestionMenuController,
  blockTypeSelectItems,
  getDefaultReactSlashMenuItems,
  useBlockNoteEditor,
  useComponentsContext,
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
type Insertable = "image" | "gallery" | "video" | "buttonLink" | "divider";

const insert = (e: Ed, type: Insertable) => {
  e.focus();
  const cur = e.getTextCursorPosition().block;
  // The slash-menu helper needs a text block under the cursor; after a photo, just append.
  if (cur.content === undefined) e.insertBlocks([{ type }], cur, "after");
  else insertOrUpdateBlockForSlashMenu(e, { type });
};

const INSERT: [string, Insertable][] = [
  ["Foto", "image"],
  ["Galleria", "gallery"],
  ["Video", "video"],
  ["Pulsante", "buttonLink"],
  ["Linea", "divider"],
];

/** Word-like toolbar, always visible above the text (the "/" menu stays for block-style editing). */
function WordToolbar() {
  const editor = useBlockNoteEditor() as unknown as Ed;
  const C = useComponentsContext()!;
  return (
    <div className="sticky top-0 z-10 mb-2 [&_.bn-toolbar]:max-w-none [&_.bn-toolbar]:flex-wrap [&_.bn-toolbar]:shadow-none">
      <FormattingToolbar>
        <BlockTypeSelect
          items={blockTypeSelectItems(editor as never).filter((i) =>
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
        {INSERT.map(([label, type]) => (
          <C.FormattingToolbar.Button
            key={type}
            label={`Inserisci ${label.toLowerCase()}`}
            mainTooltip={`Inserisci ${label.toLowerCase()}`}
            onClick={() => insert(editor, type)}
          >
            + {label}
          </C.FormattingToolbar.Button>
        ))}
      </FormattingToolbar>
    </div>
  );
}

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
        renderEditor={false}
        onChange={() => onChange(editor.document as unknown as Block[])}
      >
        <WordToolbar />
        <BlockNoteViewEditor>
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
        </BlockNoteViewEditor>
      </BlockNoteView>
    </UploadContext.Provider>
  );
}
