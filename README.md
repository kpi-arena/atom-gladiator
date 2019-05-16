
# Dependencies

- Python 3.6 or newer to run

-  `gladiator-cli` installed

Note: to install `gladiator-cli` execute the following command:

```

$ pip install --extra-index-url https://arena.kpi.fei.tuke.sk/pypi gladiator-cli

```

# Config file activation

`.gladiator.yml` file is activated after opening it in Atom (making it an active editor). Until no other `.gladiator.yml`is made active by opening it, the functionality is tied to this file.

# Provided features

- Code completion based on schema.

- Static code analysis based on schema.

- Hover support.

- Ability to create problemset file, divided into multiple subfiles connected together with `include` comments.

-  `ctrl` + `click` on `include` comments opens the given files.

- Icon in the right bottom corner indicating existence of `.gladiator.yml` file. Clicking on this icon opens the given file.

- Automatic schema association with `.gladiator.yml`, problemset and variants files.

- Path validation in `.gladiator.yml`.

- Outline for YAML files.

- Score outline for problemset files.