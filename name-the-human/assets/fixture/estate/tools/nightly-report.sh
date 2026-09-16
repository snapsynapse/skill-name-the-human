#!/bin/sh
# Synthetic fixture. Invoked nightly by launchd; emails a summary nobody has confirmed reading.
node ~/tools/report.mjs | mail -s "Nightly" team@example.invalid
