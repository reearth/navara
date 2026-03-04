# Navara Font


### Workflow of font rendering in navara:

1. user provides a URL for a font file (.ttf),
   and the string to render with some style properties (will figure out the actual properties later),
   and a WGS84 coordinate position for the text to be on the globe.

2. if the font is not the current active font:
    - navara fetches the font file
    - generate SDF atlas for the font

3. get proper shaping info from harfbuzz that will be used to properly render the text

<hr>

#### This workflow will be split between rust and typescript side:

Rust side:
- responsible for fetching the font file and generating the SDF atlas and querying shaping info from harfbuzz

- fetching and atlas generation should be done only once (if user didn't change the font or style probs that affect the SDF atlas)

- querying the shaping info will be done upon any text feature added/changed and sent back to typescript

TypeScript side:
- will get the sdf atlas (only once per font)

- make rect meshes for the characters (using instancing) (similar to how InstancedSprite worked)

- receive shaping info, puts them into instance attrib data
