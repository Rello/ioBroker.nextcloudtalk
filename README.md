# ioBroker Nextcloud Talk Adapter

This adapter allows sending notifications to Nextcloud Talk rooms.

## Configuration

This adapter now uses the ioBroker JSON configuration system. Enter the
following settings in the instance dialog:

1. **Server URL** – for example `https://nextcloud.example.com`
2. **Username** for basic authentication
3. **App Token** generated for the user
4. Optionally enable **Receive messages** and enter one **Receive room token**. The authenticated user must belong to that Talk conversation.

## States

- `roomID` (string): Talk room token used by the legacy `text` state.
- `text` (string): When written, the adapter posts the value to the room in `roomID`.
- `send` (JSON string): When written, the adapter posts `text` to the specified `roomId` without changing `roomID`.
- `received` (read-only JSON string): The latest incoming user message from the configured room. Each message is written with `ack=true` and includes `roomId`, `id`, `text`, `actorId`, `actorDisplayName`, `timestamp`, and `messageType`.
- `receiveCursor` (read-only JSON string): The saved room token and last processed message ID, used across adapter restarts.

## Usage

Existing scripts can continue writing `roomID` followed by `text` to send a message.
To select the room atomically for each message, write a JSON string to `send`:

```js
setState('nextcloudtalk.0.send', JSON.stringify({ roomId: 'abc123', text: 'Hello from ioBroker' }));
```

Both `roomId` and `text` must be non-empty strings. Writes must use `ack=false` (the default for `setState`).
Messages are sent via the Nextcloud Talk API endpoint `/ocs/v2.php/apps/spreed/api/v1/chat/{token}`.

When receiving is enabled, the adapter listens to only the configured room using one Talk long-poll request. On first start or after changing rooms, it starts after the latest existing message, so old chat history does not trigger scripts. It ignores messages from the configured account and Talk system messages, and does not mark messages or notifications as read. A brief restart between publishing an event and saving its cursor can repeat that event; scripts that act on it should track `roomId` and `id` if this matters. The adapter never executes commands from chat text.

For example, an ioBroker JavaScript script can subscribe to `nextcloudtalk.0.received` with the `change: 'any'` option, parse `obj.state.val`, and allow only specific texts and senders to trigger its own actions. Blockly can use a state-change trigger on the same state and parse its JSON value.

## Changelog

### Unreleased

### 1.0.4-beta.0
* Add atomic per-message sending through `send` while keeping `roomID` and `text` compatible.
* Add optional single-room Talk message receiving through the `received` state.

### 1.0.3
* Adapter requires node.js >= 22 now

### 1.0.2
* updated logo
* tests

### 1.0.1
* initial version

### 1.0.0
* initial version

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License

Copyright (c) 2025-2026 Rello <github@scherello.de>

[GNU Affero General Public License v3.0](LICENSE)
