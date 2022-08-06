#!/bin/bash

# create build folder with symlinks to public and dist
rm -rf build
mkdir build
for f in `ls public`; do
  ln -s ../public/$f build/$f
done
tsc
#for f in main.js main.js.map; do
#  ln -s ../dist/$f build/$f
#done

# create distribution
rm -rf dist
mkdir dist
for f in `ls build`; do
  cp -H build/$f dist/$f
done
