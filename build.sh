#!/bin/bash

# create debug folder with symlinks
rm -rf debug
mkdir -p debug/public
for f in `ls app/public`; do
  ln -s ../../app/public/$f debug/public/$f
done

echo "Compling Server"
cd server
tsc
cd ..

echo "Compling App"
cd app
tsc
cd ..

# create dist folder from debug folder
rm -rf dist
cp -RL debug dist
