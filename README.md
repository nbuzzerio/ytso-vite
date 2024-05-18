# YouTube Subscription Organizer

## Description

Application that allows you to save youtube channels to category feeds. The feed will list the latest videos of each channel by release date. This is completely agnostic to youtube's feed algorithm and more customizable.

## Node Version

This project is built and tested with Node.js version 18.19.0

## Installation

Run the following command to install dependencies:

```bash
npm install
```

## Usage

To use the project, you will need an API key from RAWG.io. Place your API key in a `.env` file in the root directory:

```
API_KEY=[API KEY]
API_URL=https://api.rawg.io/api
PORT=[PORT NUMBER]
```

Then, start the development server:

```bash
npm run dev
```

## Folder Structure

The project's folder structure is as follows:

- `src`
  - `assets`: Contains project assets such as images and fonts.
  - `components`: Contains React components used in the project.
  - `hooks`: Contains custom React hooks used in the project.
  - `services`: Contains services for interacting with the RAWG.io API.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
