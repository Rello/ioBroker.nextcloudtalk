# ioBroker Nextcloud Talk Adapter

This adapter allows sending notifications to Nextcloud Talk rooms.

## Configuration

This adapter now uses the ioBroker JSON configuration system. Enter the
following settings in the instance dialog:

1. **Server URL** – for example `https://nextcloud.example.com`
2. **Username** for basic authentication
3. **App Token** generated for the user

## States

- `roomID` (string): Talk room token used by the legacy `text` state.
- `text` (string): When written, the adapter posts the value to the room in `roomID`.
- `send` (JSON string): When written, the adapter posts `text` to the specified `roomId` without changing `roomID`.

## Usage

Existing scripts can continue writing `roomID` followed by `text` to send a message.
To select the room atomically for each message, write a JSON string to `send`:

```js
setState('nextcloudtalk.0.send', JSON.stringify({ roomId: 'abc123', text: 'Hello from ioBroker' }));
```

Both `roomId` and `text` must be non-empty strings. Writes must use `ack=false` (the default for `setState`).
Messages are sent via the Nextcloud Talk API endpoint `/ocs/v2.php/apps/spreed/api/v1/chat/{token}`.

## Changelog

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
