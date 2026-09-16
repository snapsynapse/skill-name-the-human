#!/bin/sh
# Synthetic fixture. An installer that creates a trigger the harvest cannot see until it runs.
cp launchd/com.example.site-refresh.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.example.site-refresh.plist
