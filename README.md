# ioBroker Nextcloud Talk Adapter

This adapter allows sending notifications to Nextcloud Talk rooms.

## Configuration

This adapter now uses the ioBroker JSON configuration system. Enter the
following settings in the instance dialog:

1. **Server URL** – for example `https://nextcloud.example.com`
2. **Username** for basic authentication
3. **App Token** generated for the user

## States

- `roomID` (number): ID of the room to send messages to.
- `text` (string): When this state is changed, the adapter posts the new value as a message to the configured room.

## Usage

Update the `text` state from scripts or other adapters to send a message.

## Changelog

- 1.0.0: initial version

## License

MIT

