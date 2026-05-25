# fd

`fd` is a simple, fast and user-friendly alternative to `find`.

## Features
- Intuitive syntax: `fd PATTERN` instead of `find -iname '*PATTERN*'`
- Regular expression (default) and glob-based patterns
- Very fast due to parallelized directory traversal
- Uses colors to highlight different file types
- Supports parallel command execution
- Smart case, ignores hidden files and `.gitignore` by default

## Basic usage

```bash
fd netfl
fd '^x.*rc$'
fd passwd /etc
fd
fd .
fd -e md
fd -e rs mod
fd -g libc.so /usr
```

## Hidden and ignored files

```bash
fd pre-commit
fd -H pre-commit
fd num_cpu
fd -I num_cpu
fd -HI
fd -u
```

## Matching the full path

```bash
fd -p -g '**/.git/config'
fd -p '.*/lesson-\d+/[a-z]+.(jpg|png)'
```

## Command execution

```bash
fd -e zip -x unzip
fd -e h -e cpp -x clang-format -i
fd pattern path -x echo
fd -g 'test_*.py' -X vim
fd … -X ls -lhd --color=always
fd -e cpp -e cxx -e h -e hpp -X rg 'std::cout'
fd -e jpg -x convert {} {.}.png
fd -tf -x md5sum > file_checksums.txt
```

## Placeholder syntax

- `{}` — full path of the search result
- `{.}` — path without extension
- `{/}` — basename
- `{//}` — parent directory
- `{/.}` — basename without extension

```bash
fd -x echo \;
fd pattern path -x echo
```

## Parallel vs serial

```bash
fd -j 1 …
fd --threads=1 …
```

## Excluding files or directories

```bash
fd -H -E .git …
fd -E /mnt/external-drive …
fd -E '*.bak' …
```

Use a `.fdignore` file (works like `.gitignore`).

## Deleting files

```bash
fd -H '^\.DS_Store$' -tf -X rm
fd -H '^\.DS_Store$' -tf -X rm -i
fd … -X rm -r
```

## Command-line options

```
-H, --hidden
-I, --no-ignore
-s, --case-sensitive
-i, --ignore-case
-g, --glob
-a, --absolute-path
-l, --list-details
-L, --follow
-p, --full-path
-d, --max-depth <depth>
-E, --exclude <glob>
-t, --type <filetype>
-e, --extension <ext>
-S, --size <size>
--changed-within, --changed-before
-o, --owner
--format
-x, --exec
-X, --exec-batch
-c, --color
--hyperlink
--ignore-contain
-h, --help
-V, --version
```

## Troubleshooting

```bash
fd -u …
fd '^[A-Z][0-9]+$'
fd -- '-pattern'
fd '[-]pattern'
```

Always quote regex patterns when in doubt.

## Integration examples

```bash
export FZF_DEFAULT_COMMAND='fd --type file'
fd --type f -e pdf . $HOME | rofi ...
fd --extension rs | tree --fromfile
fd -0 -e rs | xargs -0 wc -l
```

Use `fd` for fast filesystem searches and command execution on results.
