// components/LoadingIndicator.js

import React from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';

const LoadingIndicator = ({text = 'Loading...'}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={48} color="#10B981" />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // or use '#000' for full screen background
  },
  text: {
    marginTop: 16,
    fontSize: 18,
    color: '#FFFFFF',
  },
});

export default LoadingIndicator;
