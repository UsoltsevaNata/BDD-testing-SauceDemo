import path from 'path';
import { existsSync, readFileSync } from 'fs';

interface LoggingConfig {
    enabled: boolean;
    outputPath: string;
}

interface ScreenshotsConfig {
    enabled: boolean;
    path: string;
}

interface VideosConfig {
    enabled: boolean;
    path: string;
    recordOn: 'all' | 'failed' | 'off';
}

interface Config {
    logging: LoggingConfig;
    screenshots: ScreenshotsConfig;
    videos: VideosConfig;
}

const defaultConfigPath = path.resolve(process.cwd(), 'config.json');

let config: Config = {
    logging: {
        enabled: true,
        outputPath: './test-results/logs'
    },
    screenshots: {
        enabled: true,
        path: './test-results/screenshots/'
    },
    videos: {
        enabled: false,
        path: './test-results/videos/',
        recordOn: 'failed'
    }
};

if (existsSync(defaultConfigPath)) {
    const fileConfig = JSON.parse(readFileSync(defaultConfigPath, 'utf-8'));
    config = { ...config, ...fileConfig };
}

config.logging.outputPath = path.resolve(process.cwd(), config.logging.outputPath);
config.screenshots.path = path.resolve(process.cwd(), config.screenshots.path);
config.videos.path = path.resolve(process.cwd(), config.videos.path);

export default config;
