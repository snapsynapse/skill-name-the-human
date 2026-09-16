#!/bin/sh
# Synthetic fixture. Invoked hourly by launchd; writes into a shared notes folder.
rsync -a ~/notes/ ~/shared/notes/
