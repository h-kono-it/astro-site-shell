export interface FileEntry {
  name: string;
  url: string;
  title: string;
  pubDate?: Date;
  body?: string;
  tags?: string[];
}

export interface Collection {
  name: string;
  entries: FileEntry[];
}

export type FsNode = { dirs: string[]; files: FileEntry[] };
export type Fs = Record<string, FsNode>;
