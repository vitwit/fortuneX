import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';

const {width: screenWidth} = Dimensions.get('window');

type TicketProps = {
  ticketNumber: string;
  amountPaid: string;
  timestamp: string;
  poolId: string;
  contestName?: string;
  onPress?: () => void;
};

const RaffleTicket = ({
  ticketNumber,
  amountPaid,
  timestamp,
  poolId,
  contestName = 'FortuneX',
  onPress,
}: TicketProps) => {
  const [scaleAnim] = useState(new Animated.Value(1));

  // Format the timestamp to readable date
  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date
      .toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
      .toUpperCase();
  };

  // Generate ticket code from ticket number and pool ID
  const generateTicketCode = (ticketNumber: string, poolId: string) => {
    const shortPoolId = poolId;
    const shortTicketNum = ticketNumber;
    return `TK-${shortPoolId}-${shortTicketNum}`;
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.05,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  const renderPerforations = (count: number, isLeft = true) => {
    return Array.from({length: count}, (_, i) => (
      <View
        key={i}
        style={[
          styles.perforation,
          isLeft ? styles.perforationLeft : styles.perforationRight,
        ]}
      />
    ));
  };

  const renderBarcodeLines = () => {
    return Array.from({length: 45}, (_, i) => {
      let widthPercent = 25;
      if (i % 7 === 0) widthPercent = 100;
      else if (i % 6 === 0) widthPercent = 83;
      else if (i % 5 === 0) widthPercent = 80;
      else if (i % 4 === 0) widthPercent = 60;
      else if (i % 3 === 0) widthPercent = 40;
      else if (i % 2 === 0) widthPercent = 20;

      return (
        <View
          key={i}
          style={[styles.barcodeLine, {width: `${widthPercent}%`}]}
        />
      );
    });
  };

  const ticketData = {
    contestName,
    ticketCode: generateTicketCode(ticketNumber, poolId),
    boughtDate: formatDate(timestamp),
    drawDate: 'PENDING', // You can make this dynamic based on pool data
    ticketPrice: `$${amountPaid}`,
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      activeOpacity={0.9}
      style={styles.container}>
      <Animated.View
        style={[
          styles.ticketWrapper,
          {
            transform: [{scale: scaleAnim}],
          },
        ]}>
        <View style={styles.ticketContainer}>
          {/* Main Ticket Body */}
          <View style={styles.ticketBody}>
            {/* Left Side Perforations */}
            <View style={styles.leftPerforations}>
              {renderPerforations(12, true)}
            </View>

            {/* Left Side Price */}
            <View style={styles.leftPriceContainer}>
              <Text style={styles.leftPriceText}>{ticketData.ticketPrice}</Text>
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
              {/* Contest Name */}
              <Text style={styles.contestName}>{ticketData.contestName}</Text>

              {/* Ticket Code */}
              <View style={styles.ticketCodeContainer}>
                <View style={styles.ticketCodeBackground}>
                  <Text style={styles.ticketCodeText}>
                    {ticketData.ticketCode}
                  </Text>
                </View>
              </View>

              {/* Draw Date */}
              <Text style={styles.drawDate}>
                DRAW DATE: {ticketData.drawDate}
              </Text>

              {/* Pool ID */}
              <Text style={styles.poolId}>POOL: {poolId}</Text>
            </View>

            {/* Left Hatched Pattern */}
            <View style={styles.leftHatchedPattern} />
          </View>

          {/* Right Stub Section */}
          <View style={styles.rightStub}>
            {/* Right Side Perforations */}
            <View style={styles.rightPerforations}>
              {renderPerforations(12, false)}
            </View>

            {/* Barcode */}
            <View style={styles.barcodeContainer}>{renderBarcodeLines()}</View>

            {/* Bought Date */}
            <View style={styles.boughtDateContainer}>
              <Text style={styles.boughtDateText}>
                BOUGHT {ticketData.boughtDate}
              </Text>
            </View>

            {/* Right Hatched Pattern */}
            <View style={styles.rightHatchedPattern} />
          </View>
        </View>

        {/* Ticket Info */}
        {/* <View style={styles.ticketInfo}>
          <Text style={styles.ticketInfoText}>
            {ticketData.contestName} • #{ticketNumber} • {ticketData.boughtDate}
          </Text>
        </View> */}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: 'center',
  },
  ticketWrapper: {
    width: screenWidth * 0.9,
    maxWidth: 400,
  },
  ticketContainer: {
    flexDirection: 'row',
    height: 200,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  ticketBody: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    position: 'relative',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  leftPerforations: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  perforation: {
    width: 12,
    height: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
  },
  perforationLeft: {
    marginLeft: -6,
  },
  perforationRight: {
    marginRight: -6,
  },
  leftPriceContainer: {
    position: 'absolute',
    left: 15,
    top: '50%',
    transform: [{translateY: -10}, {rotate: '-90deg'}],
  },
  leftPriceText: {
    color: '#e5c384',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    opacity: 0.8,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 75,
    paddingRight: 20,
  },
  contestName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: {width: 2, height: 2},
    textShadowRadius: 4,
  },
  ticketCodeContainer: {
    marginBottom: 15,
  },
  ticketCodeBackground: {
    backgroundColor: '#e5c384',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#996f25',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  ticketCodeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    letterSpacing: 1,
    fontFamily: 'monospace',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  drawDate: {
    fontSize: 10,
    color: '#ffffff',
    opacity: 0.7,
    marginBottom: 5,
  },
  poolId: {
    fontSize: 9,
    color: '#e5c384',
    opacity: 0.6,
    fontFamily: 'monospace',
  },
  leftHatchedPattern: {
    position: 'absolute',
    left: 25,
    top: 0,
    bottom: 0,
    width: 30,
    backgroundColor: '#e5c384',
    opacity: 0.3,
  },
  rightStub: {
    width: 100,
    backgroundColor: '#e5c384',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#2a2a2a',
    borderStyle: 'dashed',
    position: 'relative',
  },
  rightPerforations: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  barcodeContainer: {
    position: 'absolute',
    right: 15,
    top: 15,
    bottom: 15,
    width: 60,
    justifyContent: 'center',
  },
  barcodeLine: {
    height: 2,
    backgroundColor: '#2a2a2a',
    marginVertical: 0.5,  
  },
  boughtDateContainer: {
    position: 'absolute',
    left: -30,
    top: '50%',
    transform: [{translateY: -10}, {rotate: '90deg'}],
  },
  boughtDateText: {
    color: '#2a2a2a',
    fontSize: 9,
    fontWeight: 'bold',
  },
  rightHatchedPattern: {
    position: 'absolute',
    right: 15,
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: '#8b7355',
    opacity: 0.4,
  },
  ticketInfo: {
    marginTop: 15,
    alignItems: 'center',
  },
  ticketInfoText: {
    color: '#e5c384',
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.8,
    textAlign: 'center',
  },
});

export default RaffleTicket;
