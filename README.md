# ioBroker Nextcloud Talk Adapter

This adapter allows sending notifications to Nextcloud Talk rooms.

## Configuration

1. Enter the Nextcloud server URL, for example `https://nextcloud.example.com`.
2. Provide the username and the app token for basic authentication.

## States

- `roomID` (number): ID of the room to send messages to.
- `text` (string): When this state is changed, the adapter posts the new value as a message to the configured room.

## Usage

Update the `text` state from scripts or other adapters to send a message.

## Changelog

- 1.0.0: initial version

## License

MIT

