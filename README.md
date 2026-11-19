# Terraria Server Panel

Power the panel from a Homepute node. Connect the Terraria server’s **Server channel OUT** to the panel’s **Server channel IN**. Choose **Open game panel** on the panel card in Studio. The signed-in Studio session reads the wired server’s CPU, memory and game logs and sends commands to that deployment. Disconnecting the wire or unplugging the panel disables commands. Connect one server per panel.

The LAN address opens the standalone panel. It reads the same server through the SDK’s HTTP/JSON connection environment. Performance and world status are visible to LAN visitors. Enter the optional companion console key configured on the Terraria server to read private logs and send commands. The key stays in the open page’s memory.

The repository-root manifest identifies the published image. The release workflow runs the channel tests and the Playtest Room SDK evidence gate before publishing the new image and preparing its pinned manifest.
