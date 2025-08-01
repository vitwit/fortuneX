import React from 'react';
import {Text, View} from 'react-native';
import LotteryPoolsComponent from './LotteryPool';

const AllPools = () => {
  return (
    <View>
      <LotteryPoolsComponent horizontalView={false} showActive={false} />
    </View>
  );
};

export default AllPools;
